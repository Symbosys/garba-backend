/** Registration fee in paise; change this value to change the fee. */
export const REGISTRATION_FEE_PAISE = 39_900;
export const REGISTRATION_CURRENCY = "INR" as const;

export const UPLOAD_LIMITS = {
  profilePhotos: 5,
  eventImages: 10,
  imageBytes: 5 * 1024 * 1024,
} as const;

export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;
