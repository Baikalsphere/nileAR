"use client"

import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Sidebar from "@/app/components/Sidebar"
import Header from "@/app/components/Header"
import {
  CorporateEmployee,
  corporateTokenStorage,
  createCorporateEmployee,
  fetchCorporateEmployees,
  updateCorporateEmployee
} from "@/lib/corporateAuth"

interface EmployeeFormState {
  fullName: string
  employeeCode: string
  email: string
  phone: string
  department: string
  designation: string
}

const emptyForm: EmployeeFormState = {
  fullName: "",
  employeeCode: "",
  email: "",
  phone: "",
  department: "",
  designation: ""
}

const normalizeOptional = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export default function EmployeesClient() {
  const router = useRouter()

  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [employees, setEmployees] = useState<CorporateEmployee[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [form, setForm] = useState<EmployeeFormState>(emptyForm)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadEmployees = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetchCorporateEmployees()
      setEmployees(response.employees)
    } catch (loadError) {
      const loadMessage = loadError instanceof Error ? loadError.message : "Failed to load employees"
      setError(loadMessage)
      if (loadMessage.toLowerCase().includes("unauthorized")) {
        corporateTokenStorage.clear()
        router.replace("/corporate-portal/login")
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const token = corporateTokenStorage.get()
    if (!token) {
      router.replace("/corporate-portal/login")
      return
    }

    setIsAuthorized(true)
    void loadEmployees()
  }, [router])

  const filteredEmployees = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) {
      return employees
    }

    return employees.filter((employee) => {
      return (
        employee.fullName.toLowerCase().includes(query) ||
        employee.employeeCode.toLowerCase().includes(query) ||
        (employee.email ?? "").toLowerCase().includes(query) ||
        (employee.department ?? "").toLowerCase().includes(query) ||
        (employee.costCenter ?? "").toLowerCase().includes(query)
      )
    })
  }, [employees, deferredSearchQuery])

  const handleFormChange = (field: keyof EmployeeFormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingEmployeeId(null)
    setIsFormModalOpen(false)
  }

  const openCreateModal = () => {
    setEditingEmployeeId(null)
    setForm(emptyForm)
    setError(null)
    setMessage(null)
    setIsFormModalOpen(true)
  }

  const handleEdit = (employee: CorporateEmployee) => {
    setEditingEmployeeId(employee.id)
    setForm({
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      department: employee.department ?? "",
        designation: employee.designation ?? ""
    })
    setMessage(null)
    setError(null)
    setIsFormModalOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSaving(true)

    const payload = {
      fullName: form.fullName,
      employeeCode: form.employeeCode,
      email: normalizeOptional(form.email),
      phone: normalizeOptional(form.phone),
      department: normalizeOptional(form.department),
      designation: normalizeOptional(form.designation),
      costCenter: null,
      status: "active" as const
    }

    try {
      if (editingEmployeeId) {
        const current = employees.find((employee) => employee.id === editingEmployeeId)
        const response = await updateCorporateEmployee(editingEmployeeId, {
          ...payload,
          status: current?.status ?? "active"
        })

        setEmployees((previous) =>
          previous.map((employee) =>
            employee.id === editingEmployeeId ? response.employee : employee
          )
        )
        setMessage("Employee updated successfully.")
      } else {
        const response = await createCorporateEmployee(payload)
        setEmployees((previous) => [response.employee, ...previous])
        setMessage("Employee added successfully.")
      }

      resetForm()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save employee")
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEmployeeStatus = async (employee: CorporateEmployee) => {
    setError(null)
    setMessage(null)

    try {
      const response = await updateCorporateEmployee(employee.id, {
        fullName: employee.fullName,
        employeeCode: employee.employeeCode,
        email: employee.email,
        phone: employee.phone,
        department: employee.department,
        designation: employee.designation,
        costCenter: employee.costCenter,
        status: employee.status === "active" ? "inactive" : "active"
      })

      setEmployees((previous) =>
        previous.map((item) => (item.id === employee.id ? response.employee : item))
      )
      setMessage(`Employee marked as ${response.employee.status}.`)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update employee status")
    }
  }

  if (!isAuthorized) {
    return null
  }

  const totalEmployees = employees.length
  const activeEmployees = employees.filter((employee) => employee.status === "active").length

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-white overflow-hidden">
      <Sidebar title="Corporate Portal" logoIcon="business" />

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto max-w-7xl flex flex-col gap-6">
            <div className="flex flex-wrap gap-2 items-center">
              <Link href="/corporate-portal" className="text-slate-500 text-sm font-medium hover:text-primary">Home</Link>
              <span className="text-slate-400 text-sm font-medium">/</span>
              <span className="text-slate-900 dark:text-white text-sm font-medium">Employees</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Employees</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Add and manage employees who stay across different hotels.</p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="h-11 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Add Employee
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total Employees</p>
                <p className="text-3xl font-bold mt-2">{totalEmployees}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Active Employees</p>
                <p className="text-3xl font-bold mt-2">{activeEmployees}</p>
              </div>
            </div>

            {message && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold">Employee Directory</h2>
                <div className="relative w-full sm:w-80">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by name, code, email..."
                    className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading employees...</div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No employees found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium">
                            <div className="flex items-center gap-2">
                              <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                {employee.fullName
                                  .split(" ")
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((word) => word[0]?.toUpperCase())
                                  .join("")}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">{employee.fullName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{employee.designation ?? "No designation"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm">{employee.employeeCode}</td>
                          <td className="px-4 py-3 text-sm">{employee.department ?? "—"}</td>
                          <td className="px-4 py-3 text-sm">{employee.email ?? "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${employee.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>
                              {employee.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(employee)}
                                className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleEmployeeStatus(employee)}
                                className="h-8 rounded-md border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                              >
                                {employee.status === "active" ? "Deactivate" : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 className="text-lg font-bold">{editingEmployeeId ? "Edit Employee" : "Add Employee"}</h2>
              <button
                type="button"
                onClick={resetForm}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input value={form.fullName} onChange={(event) => handleFormChange("fullName", event.target.value)} placeholder="Full Name" className="h-11 rounded-lg border border-slate-300 px-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700" required />
                <input value={form.employeeCode} onChange={(event) => handleFormChange("employeeCode", event.target.value)} placeholder="Employee Code" className="h-11 rounded-lg border border-slate-300 px-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700" required />
                <input value={form.email} onChange={(event) => handleFormChange("email", event.target.value)} placeholder="Email (optional)" className="h-11 rounded-lg border border-slate-300 px-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700" />
                <input value={form.phone} onChange={(event) => handleFormChange("phone", event.target.value)} placeholder="Phone (optional)" className="h-11 rounded-lg border border-slate-300 px-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700" />
                <input value={form.department} onChange={(event) => handleFormChange("department", event.target.value)} placeholder="Department" className="h-11 rounded-lg border border-slate-300 px-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700" />
                <input value={form.designation} onChange={(event) => handleFormChange("designation", event.target.value)} placeholder="Designation" className="h-11 rounded-lg border border-slate-300 px-3 text-sm bg-white dark:bg-slate-800 dark:border-slate-700" />
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingEmployeeId ? "Update Employee" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
