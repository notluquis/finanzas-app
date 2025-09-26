import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "./types";

async function handleResponse<T>(res: Response) {
  const data = await res.json();
  if (!res.ok || data.status !== "ok") {
    throw new Error(data.message || "Error inesperado en la solicitud");
  }
  return data as { status: "ok" } & T;
}

export async function fetchEmployees(includeInactive = false) {
  const params = new URLSearchParams();
  if (includeInactive) params.set("includeInactive", "true");
  const res = await fetch(`/api/employees?${params.toString()}`, { credentials: "include" });
  const data = await handleResponse<{ employees: Employee[] }>(res);
  return data.employees;
}

export async function createEmployee(payload: EmployeePayload) {
  const res = await fetch("/api/employees", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ employee: Employee }>(res);
  return data.employee;
}

export async function updateEmployee(id: number, payload: EmployeeUpdatePayload) {
  const res = await fetch(`/api/employees/${id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ employee: Employee }>(res);
  return data.employee;
}

export async function deactivateEmployee(id: number) {
  const res = await fetch(`/api/employees/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await handleResponse<{}>(res);
}
