import "./globals.css";

export const metadata = {
  title: "Listings",
  description: "Simple listing platform"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="page">
          <header className="site-header">
            <div className="site-brand">
              <span className="site-dot" aria-hidden="true" />
              <div>
                <h1>Listings</h1>
                <p>Create, browse, and manage listings with ease.</p>
              </div>
            </div>
          </header>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
