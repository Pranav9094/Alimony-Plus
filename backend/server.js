import express from "express";
import helmet from "helmet";
import "dotenv/config";
import caseRoutes from "./routes/caseRoutes.js";

import authRoutes from "./routes/authRoutes.js";
import partyRoutes from "./routes/partyRoutes.js";
import dependentRoutes from "./routes/dependentRoutes.js";
import proceedingRoutes from "./routes/proceedingRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import calculatorRoutes from "./routes/calculatorRoutes.js";

import authMiddleware from "./middleware/authMiddleware.js";

for (const name of ["DATABASE_URL", "JWT_SECRET", "FILE_ENCRYPTION_KEY"]) {
    if (!process.env[name]) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }
}

const app = express();

const PORT = Number(process.env.PORT) || 5000;

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api/dependents", dependentRoutes);
app.use("/api/proceedings", proceedingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/calculator", calculatorRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Backend is running"
    });
});

app.get("/api/protected", authMiddleware, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Protected route accessed",
        user: { id: req.user.id, role: req.user.role }
    });
});

// Bad JSON, rejected uploads and unknown routes get clean 4xx answers.
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Not found" });
});

app.use((err, req, res, next) => {
    if (err?.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Invalid JSON" });
    }
    if (err?.type === "entity.too.large") {
        return res.status(413).json({ success: false, message: "Request too large" });
    }
    if (err?.name === "MulterError" || /Only PDF/.test(err?.message || "")) {
        return res.status(400).json({ success: false, message: err.message });
    }
    console.log("Unhandled error:", err?.message);
    res.status(500).json({ success: false, message: "Something went wrong" });
});

app.listen(PORT, () => {
    console.log(`Server is running ${PORT}`);
});
