const isProduction = process.env.NODE_ENV === "production";
export const notFoundHandler = (req, res) => {
    res.status(404).json({
        message: "Route not found",
        path: req.originalUrl,
    });
};
export const errorHandler = (error, _req, res, _next) => {
    const message = !isProduction && error instanceof Error
        ? error.message
        : "Internal server error";
    if (!isProduction && error instanceof Error) {
        console.error(error);
    }
    res.status(500).json({ message });
};
//# sourceMappingURL=error.middleware.js.map