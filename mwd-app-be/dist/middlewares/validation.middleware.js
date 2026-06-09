export const validateBody = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body ?? {});
        if (!result.success) {
            return res.status(400).json({
                message: "Invalid request body",
                issues: result.error.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }
        req.body = result.data;
        next();
    };
};
//# sourceMappingURL=validation.middleware.js.map