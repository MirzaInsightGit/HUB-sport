export const API_BASE =
  process.env.NODE_ENV === 'development'
    ? process.env.REACT_APP_API_BASE_LOCAL
    : process.env.REACT_APP_API_BASE_PROD;