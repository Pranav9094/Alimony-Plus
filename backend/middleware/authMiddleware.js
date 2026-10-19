import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token required"
            });
        }

        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });
        }

        // Pin the algorithm so a forged token cannot choose a weaker one.
        // The decoded token holds personal data, so it is never logged.
        req.user = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

export default authMiddleware;
