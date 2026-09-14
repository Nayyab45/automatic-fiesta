import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema, type Token } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

export interface InAppBannerNotification {
  title: string;
  body: string;
}

// Must match the channel id the backend's FCM payload sets (see
// Backend/src/lib/push.js) -- Android otherwise silently falls back to a
// low-importance default channel with no sound/heads-up popup.
const NOTIFICATION_CHANNEL_ID = 'default';
const BANNER_DURATION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  readonly banner = signal<InAppBannerNotification | null>(null);
  private bannerTimeout?: ReturnType<typeof setTimeout>;
  private currentToken: string | null = null;
  private initialized = false;

  constructor() {
    // Keeps the backend's device_tokens table in sync with sign-in state
    // without every login/logout call site needing to remember to -- fires
    // once immediately (registering if already signed in with a token in
    // hand) and again on every future sign-in/sign-out.
    effect(() => {
      const isAuthenticated = this.authService.isAuthenticated();
      if (!this.currentToken) return;
      if (isAuthenticated) {
        this.notificationService.registerDeviceToken(this.currentToken).subscribe({ error: () => {} });
      } else {
        this.notificationService.unregisterDeviceToken(this.currentToken).subscribe({ error: () => {} });
      }
    });
  }

  /** Called once from AppComponent. No-ops on the web build (`ng serve`) -- push notifications are native-only. */
  async init(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform()) return;
    this.initialized = true;

    // Importance 5 = IMPORTANCE_HIGH: heads-up popup + sound, matching what
    // a chat app's message notifications look like. Both plugins need their
    // own channel registered -- LocalNotifications for the foreground
    // banner-companion notification below, PushNotifications for whatever
    // Android displays itself while the app is backgrounded/killed.
    await Promise.all([
      LocalNotifications.createChannel({ id: NOTIFICATION_CHANNEL_ID, name: 'General', importance: 5, visibility: 1 }),
      PushNotifications.createChannel({ id: NOTIFICATION_CHANNEL_ID, name: 'General', importance: 5, visibility: 1 }),
    ]);

    const permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') {
      const requested = await PushNotifications.requestPermissions();
      if (requested.receive !== 'granted') return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token: Token) => {
      this.currentToken = token.value;
      if (this.authService.isAuthenticated()) {
        this.notificationService.registerDeviceToken(token.value).subscribe({ error: () => {} });
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] registration failed', err);
    });

    // Android doesn't auto-display an incoming FCM notification while the
    // app is in the foreground (it hands it to this listener instead), so a
    // local notification is created manually here to still get a
    // system-tray entry + sound, alongside the in-app banner for whatever
    // page happens to be open.
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      const title = notification.title ?? 'What Should We Eat';
      const body = notification.body ?? 'You have a new notification';
      this.showBanner(title, body);
      void LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now() % 2147483647,
            title,
            body,
            channelId: NOTIFICATION_CHANNEL_ID,
          },
        ],
      });
    });

    // Tapped the system push notification (app was backgrounded/killed).
    PushNotifications.addListener('pushNotificationActionPerformed', () => {
      void this.router.navigateByUrl('/notifications');
    });

    // Tapped the local notification created above (app was foregrounded).
    LocalNotifications.addListener('localNotificationActionPerformed', () => {
      void this.router.navigateByUrl('/notifications');
    });
  }

  private showBanner(title: string, body: string): void {
    this.banner.set({ title, body });
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => this.banner.set(null), BANNER_DURATION_MS);
  }

  dismissBanner(): void {
    clearTimeout(this.bannerTimeout);
    this.banner.set(null);
  }

  onBannerTapped(): void {
    this.dismissBanner();
    void this.router.navigateByUrl('/notifications');
  }
}
