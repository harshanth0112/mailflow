export const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      req.query = schema.query.parse(req.query);
    }
    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const validateBody = (zodSchema) => (req, res, next) => {
  try {
    req.body = zodSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateParams = (zodSchema) => (req, res, next) => {
  try {
    req.params = zodSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

export const validateQuery = (zodSchema) => (req, res, next) => {
  try {
    req.query = zodSchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};


