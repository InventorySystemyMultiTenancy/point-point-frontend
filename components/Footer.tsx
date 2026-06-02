import React, { useEffect, useRef } from "react";
import "./Footer.css";

const Footer = () => {
  const footerRef = useRef<HTMLDivElement>(null);
  let lastScrollY = window.scrollY;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (footerRef.current) {
        if (currentScrollY > lastScrollY) {
          // Scrolling down
          footerRef.current.classList.remove("footer-hidden");
        } else {
          // Scrolling up
          footerRef.current.classList.add("footer-hidden");
        }
      }
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={footerRef} className="site-footer minimal-footer">
      <div className="footer-row">
        <span>
          <a href="https://wa.me/5511942058445" target="_blank" rel="noopener noreferrer">WhatsApp: 11 94205-8445</a>
        </span>
        <span>
          <a href="mailto:contato@pointpoint.com">contato@pointpoint.com</a>
        </span>
        <span>Av. Cachoeira Paulista, 17</span>
        <span>POIT&POIT 2026</span>
        <span>Todos os direitos reservados</span>
      </div>
    </div>
  );
};

export default Footer;
