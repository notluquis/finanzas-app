import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import TransactionsMovements from "./pages/TransactionsMovements";
import EmployeesPage from "./pages/Employees";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import Stats from "./pages/Stats";
import DailyBalances from "./pages/DailyBalances";
import TimesheetsPage from "./pages/Timesheets";
import ParticipantInsightsPage from "./pages/ParticipantInsights";
import CounterpartsPage from "./pages/Counterparts";
import SuppliesPage from "./pages/Supplies";
import InventoryPage from "./pages/Inventory";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <Home /> },
      { path: "/employees", element: <EmployeesPage /> },
      { path: "/upload", element: <Upload /> },
      { path: "/transactions/movements", element: <TransactionsMovements /> },
      { path: "/transactions/balances", element: <DailyBalances /> },
      { path: "/transactions/participants", element: <ParticipantInsightsPage /> },
      { path: "/counterparts", element: <CounterpartsPage /> },
      { path: "/timesheets", element: <TimesheetsPage /> },
      { path: "/supplies", element: <SuppliesPage /> },
      { path: "/data", element: <Navigate to="/transactions/movements" replace /> },
      { path: "/stats", element: <Stats /> },
      { path: "/settings", element: <Settings /> },
      { path: "/inventory", element: <InventoryPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <RouterProvider router={router} />
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);
