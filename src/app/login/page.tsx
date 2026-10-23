"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

const PRESETS = [
  {
    label: "Propriétaire (Owner A)",
    description: "Accès complet : carte, commandes, caisse, annulations",
    code: "test-a-da3172",
    email: "owner-a@test.invalid",
    role: "OWNER",
  },
  {
    label: "Serveur (Waiter A)",
    description:
      "Prise de commande, consultation carte (pas de validation caisse)",
    code: "test-a-da3172",
    email: "waiter-a@test.invalid",
    role: "WAITER",
  },
  {
    label: "Gérant (Manager A)",
    description: "Gestion opérationnelle, carte, caisse",
    code: "test-a-da3172",
    email: "manager-a@test.invalid",
    role: "MANAGER",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [restaurantCode, setRestaurantCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(
    e?: React.FormEvent,
    customCreds?: { code: string; email: string; password?: string },
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
          password: customCreds?.password ?? password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(
            "Connexion refusée. Vérifiez le code du restaurant, votre e-mail et votre mot de passe, ou demandez de l’aide à votre responsable.",
          );
        }
        if (res.status >= 500) {
          throw new Error(
            "Le service de connexion est momentanément indisponible. Réessayez dans un instant.",
          );
        }
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
      setError(
        err instanceof Error
          ? err.message
          : "Connexion impossible. Vérifiez votre réseau et réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }

  function applyPresetAndLogin(preset: (typeof PRESETS)[0]) {
    setRestaurantCode(preset.code);
    setEmail(preset.email);
    setPassword("TestPassword123!");
    void handleLogin(undefined, {
      code: preset.code,
      email: preset.email,
      password: "TestPassword123!",
    });
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
            <span>Code du restaurant</span>
            <input
              type="text"
              required
              autoComplete="organization"
              autoCapitalize="none"
              spellCheck={false}
              value={restaurantCode}
              onChange={(e) => setRestaurantCode(e.target.value)}
              placeholder="Code fourni par votre responsable"
              className={styles.input}
            />
            <span className={styles.fieldHint}>
              Ce code identifie votre établissement. Demandez-le au propriétaire
              ou au gérant si vous ne l’avez pas.
            </span>
          </label>

          <label className={styles.label}>
            <span>Adresse email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="utilisateur@domaine.com"
              className={styles.input}
            />
          </label>

          <label className={styles.label}>
            <span>Mot de passe</span>
            <div className={styles.passwordField}>
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </label>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>

        <details className={styles.presetsSection}>
          <summary className={styles.presetsTitle}>
            Accès de démonstration
          </summary>
          <p className={styles.presetsSubtitle}>
            Réservé à la base isolée de test. Ces comptes ne fonctionnent pas
            avec les données réelles de votre restaurant.
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
        </details>

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
