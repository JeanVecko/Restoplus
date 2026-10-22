"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

const PRESETS = [
  {
    label: "Propriétaire (Owner A)",
    description: "Accès complet : carte, commandes, caisse, annulations",
    code: "test-a-2029c2",
    email: "owner-a@test.invalid",
    role: "OWNER",
  },
  {
    label: "Serveur (Waiter A)",
    description:
      "Prise de commande, consultation carte (pas de validation caisse)",
    code: "test-a-2029c2",
    email: "waiter-a@test.invalid",
    role: "WAITER",
  },
  {
    label: "Caissier (Cashier A)",
    description: "Validation des commandes en caisse",
    code: "test-a-2029c2",
    email: "http-5c828299-3a9c-4661-afb1-4a1f251928ec@example.invalid",
    role: "CASHIER",
  },
  {
    label: "Gérant (Manager A)",
    description: "Gestion opérationnelle, carte, caisse",
    code: "test-a-2029c2",
    email: "manager-a@test.invalid",
    role: "MANAGER",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [restaurantCode, setRestaurantCode] = useState("test-a-2029c2");
  const [email, setEmail] = useState("owner-a@test.invalid");
  const [password, setPassword] = useState("TestPassword123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(
    e?: React.FormEvent,
    customCreds?: { code: string; email: string },
  ) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const targetCode = customCreds?.code ?? restaurantCode;
    const targetEmail = customCreds?.email ?? email;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantCode: targetCode.trim(),
          email: targetEmail.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error ?? `Erreur de connexion (HTTP ${res.status})`,
        );
      }

      setSuccess(
        `Connecté avec succès en tant que ${targetEmail} ! Redirection en cours…`,
      );
      setTimeout(() => {
        router.push("/commandes");
        router.refresh();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  function applyPresetAndLogin(preset: (typeof PRESETS)[0]) {
    setRestaurantCode(preset.code);
    setEmail(preset.email);
    setPassword("TestPassword123!");
    void handleLogin(undefined, { code: preset.code, email: preset.email });
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandKicker}>Resto+</span>
            <span className={styles.brandTitle}>Portail d&apos;accès</span>
          </Link>
          <p className={styles.subtitle}>
            Connectez-vous pour accéder au catalogue persistant, aux commandes
            et à la caisse.
          </p>
        </header>

        {error && (
          <div className={styles.errorAlert} role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className={styles.successAlert} role="status">
            {success}
          </div>
        )}

        <form className={styles.form} onSubmit={handleLogin}>
          <label className={styles.label}>
            <span>Code restaurant</span>
            <input
              type="text"
              required
              value={restaurantCode}
              onChange={(e) => setRestaurantCode(e.target.value)}
              placeholder="Ex: test-a-2029c2"
              className={styles.input}
            />
          </label>

          <label className={styles.label}>
            <span>Adresse email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="utilisateur@domaine.com"
              className={styles.input}
            />
          </label>

          <label className={styles.label}>
            <span>Mot de passe</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
            />
          </label>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>

        <section className={styles.presetsSection}>
          <h2 className={styles.presetsTitle}>
            Accès rapide aux comptes de test
          </h2>
          <p className={styles.presetsSubtitle}>
            Base isolée <code>restoplus_test_disposable</code> (mot de passe
            automatique)
          </p>
          <div className={styles.presetGrid}>
            {PRESETS.map((p) => (
              <button
                key={p.role}
                type="button"
                onClick={() => applyPresetAndLogin(p)}
                disabled={loading}
                className={styles.presetCard}
              >
                <div className={styles.presetHeading}>
                  <strong>{p.label}</strong>
                  <span className={styles.roleBadge}>{p.role}</span>
                </div>
                <p className={styles.presetDesc}>{p.description}</p>
                <code className={styles.presetEmail}>{p.email}</code>
              </button>
            ))}
          </div>
        </section>

        <nav className={styles.navLinks}>
          <Link href="/menus">Carte & Menus</Link>
          <Link href="/commandes">Prise de commandes</Link>
          <Link href="/caisse">Validation Caisse</Link>
          <Link href="/cuisine">Cuisine / Bar</Link>
        </nav>
      </div>
    </main>
  );
}
