/**
 * Dream Planners Group — Premium Interactivity Layer
 * Vanilla JS, performance-first (transform/opacity only, rAF-driven)
 */
(function () {
    'use strict';

    // ── Helpers ──────────────────────────────────────────────────────────
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || ('ontouchstart' in window)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);

    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

    // Gold colour from CSS variable
    const GOLD = '#b8952a';

    // ── 1. Scroll Reveal (replaces basic IntersectionObserver) ──────────
    function initScrollReveal() {
        // Kill existing basic observers by removing their 'visible' class and
        // re-observing with our enhanced version
        const fadeEls = document.querySelectorAll('.dpg-fade-in');
        fadeEls.forEach(el => el.classList.remove('visible'));

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                el.classList.add('visible');

                // Stagger children: cards, why-items, testimonials, culture items
                const staggerTargets = el.querySelectorAll(
                    '.dpg-card, .dpg-why-item, .dpg-testimonial, .dpg-culture-grid > div'
                );
                staggerTargets.forEach((child, i) => {
                    child.style.opacity = '0';
                    child.style.transform = 'translateY(24px)';
                    child.style.transition = 'none';
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            child.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
                            child.style.opacity = '1';
                            child.style.transform = 'translateY(0)';
                        });
                    });
                });

                revealObserver.unobserve(el);
            });
        }, { threshold: 0.08 });

        fadeEls.forEach(el => revealObserver.observe(el));
    }

    // ── 2. Animated Counters ────────────────────────────────────────────
    function initCounters() {
        const trustNumbers = document.querySelectorAll('.dpg-trust-number');
        if (!trustNumbers.length) return;

        // Store original text and parse numeric target
        const counters = [];
        trustNumbers.forEach(el => {
            const text = el.textContent.trim();
            const prefix = text.match(/^[^0-9]*/)[0]; // e.g. "$"
            const suffix = text.match(/[^0-9]*$/)[0];  // e.g. "+", "%", "M+"
            const numStr = text.replace(/[^0-9.]/g, '');
            const target = parseFloat(numStr) || 0;
            const isDecimal = numStr.includes('.');
            counters.push({ el, prefix, suffix, target, isDecimal });
            el.textContent = prefix + '0' + suffix;
        });

        let animated = false;
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting || animated) return;
                animated = true;
                counterObserver.disconnect();
                animateCounters(counters);
            });
        }, { threshold: 0.3 });

        const trustBar = document.querySelector('.dpg-trust-bar');
        if (trustBar) counterObserver.observe(trustBar);
    }

    function animateCounters(counters) {
        const duration = 2000;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = clamp(elapsed / duration, 0, 1);
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            counters.forEach(c => {
                const current = c.target * ease;
                const display = c.isDecimal ? current.toFixed(1) : Math.round(current);
                c.el.textContent = c.prefix + display + c.suffix;
            });

            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ── 3. Parallax Hero ────────────────────────────────────────────────
    function initParallax() {
        if (isMobile) return;
        const hero = document.querySelector('.dpg-hero');
        if (!hero) return;

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const scrollY = window.pageYOffset;
                if (scrollY < window.innerHeight) {
                    hero.style.backgroundPositionY = (scrollY * 0.35) + 'px';
                }
                ticking = false;
            });
        }, { passive: true });
    }

    // ── 4. Navbar Transformation ────────────────────────────────────────
    function initNavbar() {
        const nav = document.querySelector('.dpg-nav');
        if (!nav) return;

        // Inject transition styles
        const style = document.createElement('style');
        style.textContent = `
            .dpg-nav {
                transition: height 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
            }
            .dpg-nav.scrolled {
                height: 56px !important;
                box-shadow: 0 4px 24px rgba(26,36,114,0.15);
                background: rgba(255,255,255,0.96);
            }
            .dpg-nav.scrolled .dpg-nav-logo img {
                height: 34px;
                transition: height 0.3s ease;
            }
        `;
        document.head.appendChild(style);

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                if (window.pageYOffset > 100) {
                    nav.classList.add('scrolled');
                } else {
                    nav.classList.remove('scrolled');
                }
                ticking = false;
            });
        }, { passive: true });
    }

    // ── 5. Magnetic Buttons ─────────────────────────────────────────────
    function initMagneticButtons() {
        if (isMobile) return;
        const buttons = document.querySelectorAll('.dpg-btn');
        const strength = 0.3;
        const threshold = 80; // px distance

        buttons.forEach(btn => {
            btn.style.transition = 'transform 0.2s ease, background 0.2s, box-shadow 0.2s';

            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const dx = e.clientX - cx;
                const dy = e.clientY - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < threshold) {
                    btn.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
                }
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translate(0, 0)';
            });
        });
    }

    // ── 6. Custom Cursor ────────────────────────────────────────────────
    function initCustomCursor() {
        if (isMobile) return;

        const cursor = document.createElement('div');
        cursor.id = 'dpg-cursor';
        const cursorStyle = document.createElement('style');
        cursorStyle.textContent = `
            #dpg-cursor {
                position: fixed;
                top: 0; left: 0;
                width: 12px; height: 12px;
                background: ${GOLD};
                border-radius: 50%;
                pointer-events: none;
                z-index: 99999;
                mix-blend-mode: difference;
                opacity: 0;
                transition: width 0.25s ease, height 0.25s ease, opacity 0.3s ease;
                will-change: transform;
            }
            #dpg-cursor.active {
                width: 32px; height: 32px;
            }
        `;
        document.head.appendChild(cursorStyle);
        document.body.appendChild(cursor);

        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            cursor.style.opacity = '1';
        });

        document.addEventListener('mouseleave', () => {
            cursor.style.opacity = '0';
        });

        // Grow on interactive elements
        const interactiveSelector = 'a, button, .dpg-btn, .dpg-card, input, select, textarea';
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest(interactiveSelector)) {
                cursor.classList.add('active');
            }
        });
        document.addEventListener('mouseout', (e) => {
            if (e.target.closest(interactiveSelector)) {
                cursor.classList.remove('active');
            }
        });

        function animateCursor() {
            cursorX = lerp(cursorX, mouseX, 0.15);
            cursorY = lerp(cursorY, mouseY, 0.15);
            const size = cursor.classList.contains('active') ? 32 : 12;
            cursor.style.transform = `translate3d(${cursorX - size / 2}px, ${cursorY - size / 2}px, 0)`;
            requestAnimationFrame(animateCursor);
        }
        requestAnimationFrame(animateCursor);
    }

    // ── 7. Scroll Progress Bar ──────────────────────────────────────────
    function initScrollProgress() {
        const bar = document.createElement('div');
        bar.id = 'dpg-scroll-progress';
        const style = document.createElement('style');
        style.textContent = `
            #dpg-scroll-progress {
                position: fixed;
                top: 0; left: 0;
                width: 0%; height: 3px;
                background: linear-gradient(90deg, ${GOLD}, #d4a940);
                z-index: 9999;
                transition: none;
                will-change: transform;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(bar);

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                const scrollTop = window.pageYOffset;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
                bar.style.width = progress + '%';
                ticking = false;
            });
        }, { passive: true });
    }

    // ── 8. Image Reveal on Scroll ───────────────────────────────────────
    function initImageReveal() {
        const style = document.createElement('style');
        style.textContent = `
            .dpg-img-reveal {
                opacity: 0;
                transform: scale(1.05);
                transition: opacity 0.7s ease, transform 0.7s ease, clip-path 0.7s ease;
                clip-path: inset(8% 8% 8% 8%);
            }
            .dpg-img-reveal.revealed {
                opacity: 1;
                transform: scale(1);
                clip-path: inset(0 0 0 0);
            }
        `;
        document.head.appendChild(style);

        const images = document.querySelectorAll('.dpg-placeholder-img img, .dpg-culture-grid img');
        images.forEach(img => img.classList.add('dpg-img-reveal'));

        const imgObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    imgObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        images.forEach(img => imgObserver.observe(img));
    }

    // ── 9. Smooth Anchor Scrolling ──────────────────────────────────────
    function initSmoothAnchors() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="#"]');
            if (!link) return;
            const hash = link.getAttribute('href');
            if (hash === '#') return;
            const target = document.querySelector(hash);
            if (!target) return;

            e.preventDefault();
            const navHeight = document.querySelector('.dpg-nav')?.offsetHeight || 0;
            const targetY = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 16;

            smoothScrollTo(targetY, 800);
        });
    }

    function smoothScrollTo(targetY, duration) {
        const startY = window.pageYOffset;
        const diff = targetY - startY;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = clamp(elapsed / duration, 0, 1);
            // Ease in-out cubic
            const ease = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            window.scrollTo(0, startY + diff * ease);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ── 10. Card Tilt Effect ────────────────────────────────────────────
    function initCardTilt() {
        if (isMobile) return;
        const cards = document.querySelectorAll('.dpg-card, .dpg-why-item');

        cards.forEach(card => {
            card.style.transformStyle = 'preserve-3d';
            card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease';

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                const tiltX = -y * 5;  // max 5 degrees
                const tiltY = x * 5;
                card.style.transform = `perspective(600px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-3px)`;
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(600px) rotateX(0) rotateY(0) translateY(0)';
            });
        });
    }

    // ── 11. Text Split Animation ────────────────────────────────────────
    function initTextSplit() {
        const headings = document.querySelectorAll('.dpg-fade-in h1, .dpg-fade-in h2');
        if (!headings.length) return;

        const style = document.createElement('style');
        style.textContent = `
            .dpg-split-word {
                display: inline-block;
                opacity: 0;
                transform: translateY(16px);
                transition: opacity 0.4s ease, transform 0.4s ease;
            }
            .dpg-split-word.revealed {
                opacity: 1;
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);

        headings.forEach(heading => {
            // Preserve the original HTML by working with text nodes
            const text = heading.textContent;
            const words = text.split(/\s+/).filter(w => w.length > 0);
            heading.innerHTML = words.map(word =>
                `<span class="dpg-split-word">${word}</span>`
            ).join(' ');
        });

        const splitObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const words = entry.target.querySelectorAll('.dpg-split-word');
                words.forEach((word, i) => {
                    word.style.transitionDelay = (i * 0.05) + 's';
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            word.classList.add('revealed');
                        });
                    });
                });
                splitObserver.unobserve(entry.target);
            });
        }, { threshold: 0.2 });

        headings.forEach(h => splitObserver.observe(h));
    }

    // ── 13. Back to Top Button ──────────────────────────────────────────
    function initBackToTop() {
        const btn = document.createElement('button');
        btn.id = 'dpg-back-top';
        btn.setAttribute('aria-label', 'Back to top');
        btn.innerHTML = '&#8593;';

        const style = document.createElement('style');
        style.textContent = `
            #dpg-back-top {
                position: fixed;
                bottom: 32px; right: 32px;
                width: 44px; height: 44px;
                border-radius: 50%;
                background: ${GOLD};
                color: #fff;
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                z-index: 9000;
                opacity: 0;
                transform: translateY(12px);
                transition: opacity 0.3s ease, transform 0.3s ease, background 0.2s ease;
                pointer-events: none;
                box-shadow: 0 4px 16px rgba(184,149,42,0.35);
            }
            #dpg-back-top.visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            #dpg-back-top:hover {
                background: #d4a940;
                transform: translateY(-2px);
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(btn);

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                if (window.pageYOffset > 500) {
                    btn.classList.add('visible');
                } else {
                    btn.classList.remove('visible');
                }
                ticking = false;
            });
        }, { passive: true });

        btn.addEventListener('click', () => {
            smoothScrollTo(0, 600);
        });
    }

    // ── Init ────────────────────────────────────────────────────────────
    function init() {
        initScrollReveal();
        initCounters();
        initParallax();
        initNavbar();
        initMagneticButtons();
        initCustomCursor();
        initScrollProgress();
        initImageReveal();
        initSmoothAnchors();
        initCardTilt();
        initTextSplit();
        initBackToTop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
