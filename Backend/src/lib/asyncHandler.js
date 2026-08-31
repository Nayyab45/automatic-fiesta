// Express 4 doesn't catch a rejected promise from an async route handler --
// it becomes an unhandled rejection, which crashes the whole process instead
// of producing a 500. Wrapping every async handler in this forwards the
// rejection to Express's error-handling middleware via next(err) instead.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
