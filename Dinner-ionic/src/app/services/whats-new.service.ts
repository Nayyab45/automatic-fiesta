import { Injectable } from '@angular/core';

export interface WhatsNewItem {
  icon: string;
  title: string;
  description: string;
}

// Bump this whenever new features should be announced again.
const WHATS_NEW_VERSION = '2026.08';
const STORAGE_KEY = 'whatsNewVersionSeen';

@Injectable({ providedIn: 'root' })
export class WhatsNewService {
  readonly version = WHATS_NEW_VERSION;

  readonly items: WhatsNewItem[] = [
    {
      icon: 'restaurant_menu',
      title: 'Explore Full Menus',
      description: "Browse a restaurant's featured dishes and top-rated picks before you book a table.",
    },
    {
      icon: 'badge',
      title: 'Streamlined Identity Verification',
      description: 'Verify your identity in clear steps: upload your CNIC, then submit for review.',
    },
    {
      icon: 'group',
      title: 'Table Guest Details',
      description: 'See who has confirmed, who is pending, and manage seats for any dining table at a glance.',
    },
    {
      icon: 'manage_accounts',
      title: 'Manage Account',
      description: 'Update your name, email, and phone number from a dedicated Manage Account screen.',
    },
  ];

  shouldShow(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== WHATS_NEW_VERSION;
    } catch {
      return false;
    }
  }

  markSeen(): void {
    try {
      localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION);
    } catch {
      /* localStorage unavailable, nothing to persist */
    }
  }
}
