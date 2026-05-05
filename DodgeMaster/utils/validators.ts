/** Input validation utilities. All functions return null on pass, or an error string. */

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email is required.';
  // RFC 5322-inspired regex — catches the most common invalid formats
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(trimmed)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter.';
  if (!/[0-9]/.test(password)) return 'Include at least one number.';
  return null;
}

export function validatePasswordConfirm(
  password: string,
  confirm: string,
): string | null {
  if (!confirm) return 'Please confirm your password.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

export function validateOTP(otp: string): string | null {
  if (!otp) return 'Verification code is required.';
  if (!/^\d{6}$/.test(otp)) return 'Enter the 6-digit code from your app.';
  return null;
}
