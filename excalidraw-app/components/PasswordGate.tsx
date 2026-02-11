import React, { useState } from "react";
import "./PasswordGate.scss";

interface PasswordGateProps {
    children: React.ReactNode;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ children }) => {
    const [password, setPassword] = useState("");
    const [isAuthorized, setIsAuthorized] = useState(() => {
        return localStorage.getItem("is_authorized") === "true";
    });
    const [error, setError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Artificial delay for premium feel
        setTimeout(() => {
            const correctPassword = import.meta.env.VITE_APP_PASSWORD;
            if (password === correctPassword) {
                localStorage.setItem("is_authorized", "true");
                setIsAuthorized(true);
                setError(false);
            } else {
                setError(true);
                setPassword("");
            }
            setIsLoading(false);
        }, 800);
    };

    if (isAuthorized) {
        return <>{children}</>;
    }

    return (
        <div className="password-gate-container">
            <div className="password-gate-glass">
                <div className="password-gate-content">
                    <div className="password-gate-header">
                        <div className="logo-container">
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 40 40"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <rect width="40" height="40" rx="10" fill="currentColor" />
                                <path
                                    d="M12 20L28 20M20 12L20 28"
                                    stroke="white"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                        <h1>Secure Access</h1>
                        <p>Please enter the password to access Glyph</p>
                    </div>

                    <form onSubmit={handleLogin} className="password-gate-form">
                        <div className={`input-group ${error ? "error" : ""}`}>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                autoFocus
                                disabled={isLoading}
                            />
                            {error && <span className="error-message">Incorrect password. Please try again.</span>}
                        </div>
                        <button type="submit" className={isLoading ? "loading" : ""} disabled={isLoading}>
                            {isLoading ? (
                                <div className="spinner"></div>
                            ) : (
                                "Unlock Workspace"
                            )}
                        </button>
                    </form>

                    <div className="password-gate-footer">
                        <span>Powered by Glyph Engine</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PasswordGate;
