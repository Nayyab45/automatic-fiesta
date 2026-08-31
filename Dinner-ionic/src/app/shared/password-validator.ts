import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Mirrors Backend/src/lib/validate.js's passwordStrengthError -- keep these
// two in sync. Duplicated rather than shared across the repo boundary since
// there's no shared package between the Angular app and the Node backend.
export const PASSWORD_MIN_LENGTH = 8;

export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string = control.value ?? '';
    if (value.length === 0) return null; // let Validators.required own the empty case
    if (value.length < PASSWORD_MIN_LENGTH) return { passwordTooShort: true };
    if (!/\d/.test(value)) return { passwordNeedsNumber: true };
    if (!/[^A-Za-z0-9]/.test(value)) return { passwordNeedsSpecialChar: true };
    return null;
  };
}

/** Turns the validator's error object into the same message text the
 * backend would send back, so the error reads identically whether it's
 * caught client-side before submit or server-side after. */
export function passwordErrorMessage(errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  if (errors['required']) return 'Password is required';
  if (errors['passwordTooShort']) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (errors['passwordNeedsNumber']) return 'Password must include at least one number';
  if (errors['passwordNeedsSpecialChar']) return 'Password must include at least one special character';
  return null;
}
