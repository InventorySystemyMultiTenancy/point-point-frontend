import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./Footer.css";
import { getCategories } from "../services/categoryService";
import logo from "../assets/pointpointcorrect-transparent.png";

const PAYMENT_BADGES: { name: string; src: string }[] = [
  { name: "Visa", src: "/payment-logos/visa.svg" },
  { name: "Mastercard", src: "/payment-logos/mastercard.svg" },
  { name: "Elo", src: "/payment-logos/elo.svg" },
  { name: "Amex", src: "/payment-logos/amex.svg" },
  { name: "Pix", src: "/payment-logos/pix.svg" },
];

const SocialIcon: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <button
    type="button"
    className="footer-social-btn"
    aria-label={label}
    title={`${label} (em breve)`}
  >
    {children}
  </button>
);

const Footer: React.FC = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getCategories({ catalog: true })
      .then((categories) => {
        if (cancelled) return;
        setCategoryNames(
          [...categories]
            .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
            .map((category) => category.name),
        );
      })
      .catch(() => {
        if (!cancelled) setCategoryNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="site-footer-v2">
      <div className="footer-newsletter">
        <div className="footer-newsletter-inner">
          <div className="footer-newsletter-copy">
            <span className="footer-newsletter-eyebrow">
              Receba novidades e promoções exclusivas
            </span>
            <h2>
              Fique por dentro de tudo que é <em>fofo e especial</em>!
            </h2>
          </div>
          <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
            <div className="footer-newsletter-input-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu melhor e-mail"
                aria-label="Seu melhor e-mail"
              />
              <button type="submit">Cadastrar</button>
            </div>
            <p className="footer-newsletter-note">
              {subscribed
                ? "Prontinho! Em breve novidades no seu e-mail. 💌"
                : "Prometemos não enviar spam. Só muito amor!"}
            </p>
          </form>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-main-inner">
          <div className="footer-col footer-brand-col">
            <img src={logo} alt="POIT&POIT" className="footer-logo" />
            <p className="footer-tagline">
              Pelúcias feitas para abraçar, presentear e eternizar momentos
              especiais.
            </p>
            <div className="footer-social">
              <SocialIcon label="Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </SocialIcon>
              <SocialIcon label="TikTok">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M14.5 3h2.6c.2 1.6 1.3 3 3 3.4v2.6c-1.1 0-2.2-.3-3.1-.9v6.4a5.1 5.1 0 1 1-4.2-5v2.7a2.4 2.4 0 1 0 1.7 2.3V3z" />
                </svg>
              </SocialIcon>
              <SocialIcon label="Facebook">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M13.5 21v-7.5H16l.4-3H13.5V8.4c0-.9.2-1.5 1.5-1.5H16.5V4.2C16.2 4.1 15.2 4 14 4c-2.4 0-4 1.5-4 4.1v2.4H7.5v3H10V21h3.5z" />
                </svg>
              </SocialIcon>
            </div>
          </div>

          <div className="footer-col">
            <h3>Institucional</h3>
            <ul>
              <li><Link to="/pagina/quem-somos">Quem somos</Link></li>
              <li><Link to="/pagina/nossa-historia">Nossa história</Link></li>
              <li>
                <Link to="/pagina/politica-de-qualidade">
                  Política de qualidade
                </Link>
              </li>
              <li>
                <Link to="/pagina/trabalhe-conosco">Trabalhe conosco</Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Ajuda</h3>
            <ul>
              <li>
                <Link to="/pagina/central-de-ajuda">Central de ajuda</Link>
              </li>
              <li>
                <Link to="/pagina/entrega-e-prazos">Entrega e prazos</Link>
              </li>
              <li>
                <a href="mailto:contato@pointpoint.com">Fale conosco</a>
              </li>
              <li>
                <a
                  href="https://wa.me/5516997735290"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Categorias</h3>
            <ul>
              {categoryNames.length > 0 ? (
                categoryNames.map((category) => (
                  <li key={category}>
                    <Link to={`/menu?cat=${encodeURIComponent(category)}`}>
                      {category}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <Link to="/menu">Ver catálogo</Link>
                </li>
              )}
            </ul>
          </div>

          <div className="footer-col footer-trust-col">
            <h3>Formas de pagamento</h3>
            <div className="footer-payment-badges">
              {PAYMENT_BADGES.map(({ name, src }) => (
                <span key={name} className="footer-payment-badge" title={name}>
                  <img src={src} alt={name} loading="lazy" />
                </span>
              ))}
              <span className="footer-payment-badge footer-payment-badge-text">
                Boleto
              </span>
            </div>

            <h3>Segurança</h3>
            <div className="footer-security-badges">
              <div className="footer-security-badge">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
                </svg>
                <span>Compra segura</span>
              </div>
              <div className="footer-security-badge">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <span>Conexão segura (SSL)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <div className="footer-bottom-inner">
          <span>
            © {new Date().getFullYear()} POIT&POIT. Todos os direitos
            reservados.
          </span>
          <div className="footer-bottom-links">
            <Link to="/pagina/politica-de-privacidade">
              Política de Privacidade
            </Link>
            <Link to="/pagina/termos-de-uso">Termos de Uso</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
