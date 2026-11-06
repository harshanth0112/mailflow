import { ApiError } from '../utils/apiResponse.js';

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Endpoint not found - ${req.originalUrl}`));
};

