import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

// Routes reachable without being signed in. Every other route requires auth
// (see the `.map()` below) now that a real user/session model exists.
const publicPaths = new Set([
  'splash',
  'loading',
  'login',
  'signup',
  'reset-password',
  'reset-password-confirmation',
  'terms-of-service',
  'privacy-policy',
  'community-guidelines',
  'full-community-policy',
  'error',
]);

// Each route lazy-loads its standalone page component, generated 1:1 from
// the original prototype screens (see /docs in the project root README).
//
// Record-scoped screens are registered twice: once bare and once with `/:id`.
// The bare form keeps today's hard-coded prototype links working; the `/:id`
// form is what real data will use. Read the value via `BasePage.routeId`.
const routeDefinitions: Routes = [
  { path: '', redirectTo: 'splash', pathMatch: 'full' },
  { path: 'splash', loadComponent: () => import('./pages/splash/splash.page').then((m) => m.SplashPage) },
  { path: 'loading', loadComponent: () => import('./pages/loading/loading.page').then((m) => m.LoadingPage) },
  { path: 'login', loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup.page').then((m) => m.SignupPage) },
  { path: 'profile-creation', loadComponent: () => import('./pages/profile-creation/profile-creation.page').then((m) => m.ProfileCreationPage) },
  { path: 'personal-interests', loadComponent: () => import('./pages/personal-interests/personal-interests.page').then((m) => m.PersonalInterestsPage) },
  { path: 'food-preferences', loadComponent: () => import('./pages/food-preferences/food-preferences.page').then((m) => m.FoodPreferencesPage) },
  { path: 'dietary-preferences', loadComponent: () => import('./pages/dietary-preferences/dietary-preferences.page').then((m) => m.DietaryPreferencesPage) },
  { path: 'home', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },
  { path: 'discover-restaurants', loadComponent: () => import('./pages/discover-restaurants/discover-restaurants.page').then((m) => m.DiscoverRestaurantsPage) },
  { path: 'discover-people', loadComponent: () => import('./pages/discover-people/discover-people.page').then((m) => m.DiscoverPeoplePage) },
  { path: 'search-filter', loadComponent: () => import('./pages/search-filter/search-filter.page').then((m) => m.SearchFilterPage) },
  { path: 'ai-matching', loadComponent: () => import('./pages/ai-matching/ai-matching.page').then((m) => m.AiMatchingPage) },
  { path: 'ai-restaurant-recommendation', loadComponent: () => import('./pages/ai-restaurant-recommendation/ai-restaurant-recommendation.page').then((m) => m.AiRestaurantRecommendationPage) },
  { path: 'restaurant-detail', loadComponent: () => import('./pages/restaurant-detail/restaurant-detail.page').then((m) => m.RestaurantDetailPage) },
  { path: 'restaurant-detail/:id', loadComponent: () => import('./pages/restaurant-detail/restaurant-detail.page').then((m) => m.RestaurantDetailPage) },
  { path: 'restaurant-direction', loadComponent: () => import('./pages/restaurant-direction/restaurant-direction.page').then((m) => m.RestaurantDirectionPage) },
  { path: 'restaurant-direction/:id', loadComponent: () => import('./pages/restaurant-direction/restaurant-direction.page').then((m) => m.RestaurantDirectionPage) },
  { path: 'my-tables', loadComponent: () => import('./pages/my-tables/my-tables.page').then((m) => m.MyTablesPage) },
  { path: 'empty-state-table', loadComponent: () => import('./pages/empty-state-table/empty-state-table.page').then((m) => m.EmptyStateTablePage) },
  { path: 'create-table', loadComponent: () => import('./pages/create-table/create-table.page').then((m) => m.CreateTablePage) },
  { path: 'dining-event-details', loadComponent: () => import('./pages/dining-event-details/dining-event-details.page').then((m) => m.DiningEventDetailsPage) },
  { path: 'dining-event-details/:id', loadComponent: () => import('./pages/dining-event-details/dining-event-details.page').then((m) => m.DiningEventDetailsPage) },
  { path: 'guest-list', loadComponent: () => import('./pages/guest-list/guest-list.page').then((m) => m.GuestListPage) },
  { path: 'guest-list/:id', loadComponent: () => import('./pages/guest-list/guest-list.page').then((m) => m.GuestListPage) },
  { path: 'request-seat', loadComponent: () => import('./pages/request-seat/request-seat.page').then((m) => m.RequestSeatPage) },
  { path: 'request-seat/:id', loadComponent: () => import('./pages/request-seat/request-seat.page').then((m) => m.RequestSeatPage) },
  { path: 'request-status', loadComponent: () => import('./pages/request-status/request-status.page').then((m) => m.RequestStatusPage) },
  { path: 'request-status/:id', loadComponent: () => import('./pages/request-status/request-status.page').then((m) => m.RequestStatusPage) },
  { path: 'check-in', loadComponent: () => import('./pages/check-in/check-in.page').then((m) => m.CheckInPage) },
  { path: 'check-in/:id', loadComponent: () => import('./pages/check-in/check-in.page').then((m) => m.CheckInPage) },
  { path: 'post-dining-review', loadComponent: () => import('./pages/post-dining-review/post-dining-review.page').then((m) => m.PostDiningReviewPage) },
  { path: 'post-dining-review/:id', loadComponent: () => import('./pages/post-dining-review/post-dining-review.page').then((m) => m.PostDiningReviewPage) },
  { path: 'dining-group-chat', loadComponent: () => import('./pages/dining-group-chat/dining-group-chat.page').then((m) => m.DiningGroupChatPage) },
  { path: 'dining-group-chat/:id', loadComponent: () => import('./pages/dining-group-chat/dining-group-chat.page').then((m) => m.DiningGroupChatPage) },
  { path: 'dining-group-chat/dm/:id', loadComponent: () => import('./pages/dining-group-chat/dining-group-chat.page').then((m) => m.DiningGroupChatPage), data: { mode: 'dm' } },
  { path: 'messages', loadComponent: () => import('./pages/messages/messages.page').then((m) => m.MessagesPage) },
  { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications.page').then((m) => m.NotificationsPage) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage) },
  { path: 'profile/:id', loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage) },
  { path: 'edit-preferences', loadComponent: () => import('./pages/edit-preferences/edit-preferences.page').then((m) => m.EditPreferencesPage) },
  { path: 'settings', loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage) },
  { path: 'premium-members', loadComponent: () => import('./pages/premium-members/premium-members.page').then((m) => m.PremiumMembersPage) },
  { path: 'safety-center', loadComponent: () => import('./pages/safety-center/safety-center.page').then((m) => m.SafetyCenterPage) },
  { path: 'safety-checkin', loadComponent: () => import('./pages/safety-checkin/safety-checkin.page').then((m) => m.SafetyCheckinPage) },
  { path: 'safety-checkin/:id', loadComponent: () => import('./pages/safety-checkin/safety-checkin.page').then((m) => m.SafetyCheckinPage) },
  { path: 'emergency-contacts', loadComponent: () => import('./pages/emergency-contacts/emergency-contacts.page').then((m) => m.EmergencyContactsPage) },
  { path: 'community-guidelines', loadComponent: () => import('./pages/community-guidelines/community-guidelines.page').then((m) => m.CommunityGuidelinesPage) },
  { path: 'report-users', loadComponent: () => import('./pages/report-users/report-users.page').then((m) => m.ReportUsersPage) },
  { path: 'report-users/:id', loadComponent: () => import('./pages/report-users/report-users.page').then((m) => m.ReportUsersPage) },
  { path: 'future-features', loadComponent: () => import('./pages/future-features/future-features.page').then((m) => m.FutureFeaturesPage) },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.page').then((m) => m.ResetPasswordPage) },
  { path: 'reset-password-confirmation', loadComponent: () => import('./pages/reset-password-confirmation/reset-password-confirmation.page').then((m) => m.ResetPasswordConfirmationPage) },
  { path: 'terms-of-service', loadComponent: () => import('./pages/terms-of-service/terms-of-service.page').then((m) => m.TermsOfServicePage) },
  { path: 'privacy-policy', loadComponent: () => import('./pages/privacy-policy/privacy-policy.page').then((m) => m.PrivacyPolicyPage) },
  { path: 'privacy-settings', loadComponent: () => import('./pages/privacy-settings/privacy-settings.page').then((m) => m.PrivacySettingsPage) },
  { path: 'identity-verification', loadComponent: () => import('./pages/identity-verification/identity-verification.page').then((m) => m.IdentityVerificationPage) },
  { path: 'blocked-users', loadComponent: () => import('./pages/blocked-users/blocked-users.page').then((m) => m.BlockedUsersPage) },
  { path: 'full-community-policy', loadComponent: () => import('./pages/full-community-policy/full-community-policy.page').then((m) => m.FullCommunityPolicyPage) },
  { path: 'help-support', loadComponent: () => import('./pages/help-support/help-support.page').then((m) => m.HelpSupportPage) },
  { path: 'subscribe-to-premium', loadComponent: () => import('./pages/subscribe-to-premium/subscribe-to-premium.page').then((m) => m.SubscribeToPremiumPage) },
  { path: 'subscribe-to-premium-success', loadComponent: () => import('./pages/subscribe-to-premium-success/subscribe-to-premium-success.page').then((m) => m.SubscribeToPremiumSuccessPage) },
  { path: 'explore-menu', loadComponent: () => import('./pages/explore-menu/explore-menu.page').then((m) => m.ExploreMenuPage) },
  { path: 'explore-menu/:id', loadComponent: () => import('./pages/explore-menu/explore-menu.page').then((m) => m.ExploreMenuPage) },
  { path: 'identity-verification-id-upload', loadComponent: () => import('./pages/identity-verification-id-upload/identity-verification-id-upload.page').then((m) => m.IdentityVerificationIdUploadPage) },
  { path: 'face-verification', loadComponent: () => import('./pages/face-verification/face-verification.page').then((m) => m.FaceVerificationPage) },
  { path: 'identity-verification-submit-review', loadComponent: () => import('./pages/identity-verification-submit-review/identity-verification-submit-review.page').then((m) => m.IdentityVerificationSubmitReviewPage) },
  { path: 'manage-account', loadComponent: () => import('./pages/manage-account/manage-account.page').then((m) => m.ManageAccountPage) },
  { path: 'table-details-guests', loadComponent: () => import('./pages/table-details-guests/table-details-guests.page').then((m) => m.TableDetailsGuestsPage) },
  { path: 'table-details-guests/:id', loadComponent: () => import('./pages/table-details-guests/table-details-guests.page').then((m) => m.TableDetailsGuestsPage) },
  { path: 'select-location', loadComponent: () => import('./pages/select-location/select-location.page').then((m) => m.SelectLocationPage) },
  { path: 'payment-methods', loadComponent: () => import('./pages/payment-methods/payment-methods.page').then((m) => m.PaymentMethodsPage) },
  { path: 'error', loadComponent: () => import('./pages/error/error.page').then((m) => m.ErrorPage) },
  { path: '**', loadComponent: () => import('./pages/error/error.page').then((m) => m.ErrorPage) },
];

function isPublic(path: string | undefined): boolean {
  if (path === undefined || path === '' || path === '**') return true;
  return publicPaths.has(path.split('/')[0]);
}

export const routes: Routes = routeDefinitions.map((route) =>
  isPublic(route.path) ? route : { ...route, canActivate: [authGuard] },
);
