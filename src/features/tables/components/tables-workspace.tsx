"use client";

import { useEffect, useState } from "react";
import styles from "./tables-workspace.module.css";

type DiningTable = {
  id: string;
  tableNumber: string;
  zone: "STANDARD" | "TERRACE" | "VIP";
  capacity: number;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  tableNumber: string;
  zone: "STANDARD" | "TERRACE" | "VIP";
  capacity: number;
};

const EMPTY_FORM: FormState = {
  tableNumber: "",
  zone: "STANDARD",
  capacity: 4,
};

export function TablesWorkspace() {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    try {
      const response = await fetch("/api/tables", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error ?? "Impossible de charger les tables depuis le serveur.",
        );
      }
      setTables(data.tables ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    (async () => { await load(); })();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/tables/${editingId}` : "/api/tables";
      const response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Enregistrement refusé.");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/tables/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Désactivation refusée.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur serveur.");
    }
  }

  function startEdit(table: DiningTable) {
    setEditingId(table.id);
    setForm({
      tableNumber: table.tableNumber,
      zone: table.zone,
      capacity: table.capacity,
    });
  }

  const zoneLabel: Record<DiningTable["zone"], string> = {
    STANDARD: "Standard",
    TERRACE: "Terrasse",
    VIP: "VIP",
  };

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Tables et salles</p>
          <h1>Gestion des tables</h1>
          <p className={styles.subtitle}>
            Numéros, zones tarifaires, capacités et états des tables de votre
            restaurant.
          </p>
        </div>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => load()}
          disabled={saving}
        >
          Actualiser
        </button>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <label>
          Numéro de table
          <input
            required
            maxLength={30}
            value={form.tableNumber}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, tableNumber: event.target.value }))
            }
          />
        </label>
        <label>
          Zone tarifaire
          <select
            value={form.zone}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                zone: event.target.value as FormState["zone"],
              }))
            }
          >
            <option value="STANDARD">Standard</option>
            <option value="TERRACE">Terrasse</option>
            <option value="VIP">VIP</option>
          </select>
        </label>
        <label>
          Capacité
          <input
            type="number"
            min={1}
            max={500}
            value={form.capacity}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                capacity: Number(event.target.value) || 1,
              }))
            }
          />
        </label>
        <div className={styles.formActions}>
          <button type="submit" disabled={saving}>
            {editingId ? "Enregistrer" : "Ajouter la table"}
          </button>
          {editingId && (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      {!loaded ? (
        <div className={styles.state}>Chargement des tables…</div>
      ) : tables.length === 0 ? (
        <div className={styles.state}>
          Aucune table enregistrée. Commencez par en créer une ci-dessus.
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Table</th>
              <th>Zone</th>
              <th>Capacité</th>
              <th>État</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <tr key={table.id}>
                <td>{table.tableNumber}</td>
                <td>{zoneLabel[table.zone]}</td>
                <td>{table.capacity}</td>
                <td>{table.status}</td>
                <td>
                  <span
                    className={
                      table.isActive ? styles.active : styles.inactive
                    }
                  >
                    {table.isActive ? "Active" : "Désactivée"}
                  </span>
                </td>
                <td>
                  {table.isActive ? (
                    <>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => startEdit(table)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => handleDeactivate(table.id)}
                      >
                        Désactiver
                      </button>
                    </>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
