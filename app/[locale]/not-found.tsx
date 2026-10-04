import Link from "next/link";

// Rendered inside the locale layout, which has no access to the locale here,
// so the copy stays multilingual and links to the root (the proxy picks the language).
export default function NotFound() {
  return (
    <main className="wrap intro">
      <h1>404</h1>
      <p>Página não encontrada · Page not found · Página no encontrada</p>
      <p>
        <Link href="/" className="button">
          ←
        </Link>
      </p>
    </main>
  );
}
