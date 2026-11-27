/**
 * Ube Stay — motion.js
 * Scroll animations with GSAP + ScrollTrigger, smooth scrolling with Lenis.
 *
 *  1. Smooth scrolling (Lenis), kept in sync with ScrollTrigger
 *  2. Opening curtain (first visit to the top page) + hero text
 *  3. Text that rises in letter by letter   [data-split], big section titles
 *  4. Fade-up and photo "mask" reveals      [data-reveal], cards, lists
 *  5. Parallax photos                        [data-parallax]
 *  6. Rooms: sideways gallery while scrolling down   [data-hscroll]
 *
 * The 3D room tour is separate (assets/js/room3d/, loaded on click).
 *
 * Runs only when <html> has the "motion" class (set in <head> unless the
 * visitor chose "reduce motion"). If anything fails, we remove the class,
 * so the page is simply shown without animation.
 */
( function () {
	'use strict';

	var root = document.documentElement;
	if ( ! root.classList.contains( 'motion' ) ) {
		return;
	}
	if ( ! window.gsap || ! window.ScrollTrigger ) {
		root.classList.remove( 'motion', 'intro' );
		return;
	}
	root.classList.add( 'motion-ready' ); // Tells the 4-second safety net we started.

	var gsap = window.gsap;
	var ScrollTrigger = window.ScrollTrigger;
	gsap.registerPlugin( ScrollTrigger );

	var EASE = 'expo.out';

	// Never leave content hidden because of a bug.
	function fail( error ) {
		root.classList.remove( 'motion', 'intro' );
		window.console && console.error( error );
	}

	// The hero first (it is on screen). Then the rest, one step per task,
	// so the browser can draw and respond in between (no long freeze on
	// slow phones). setTimeout( fn, 0 ) = "run after the current work".
	var steps = [
		smoothScroll,
		intro,
		reveals,
		parallax,
		roomGallery,
		function () {
			ScrollTrigger.refresh();
		},
	];
	( function next() {
		var step = steps.shift();
		if ( ! step ) {
			return;
		}
		try {
			step();
		} catch ( error ) {
			fail( error );
			return;
		}
		setTimeout( next, 0 );
	} )();

	// Photos change the page height when they load: measure again.
	window.addEventListener( 'load', function () {
		ScrollTrigger.refresh();
	} );

	/* 1. Smooth scrolling ------------------------------------------------ */
	function smoothScroll() {
		if ( ! window.Lenis ) {
			return;
		}
		// Touch devices keep their native scrolling (feels better, no lag).
		var lenis = new window.Lenis( { lerp: 0.09, wheelMultiplier: 0.9 } );
		window.ubestayLenis = lenis;
		lenis.on( 'scroll', ScrollTrigger.update );
		gsap.ticker.add( function ( time ) {
			lenis.raf( time * 1000 );
		} );
		gsap.ticker.lagSmoothing( 0 );

		// Stop smooth scrolling while the mobile menu is open.
		var toggle = document.querySelector( '.menu-toggle' );
		if ( toggle ) {
			new MutationObserver( function () {
				if ( toggle.getAttribute( 'aria-expanded' ) === 'true' ) {
					lenis.stop();
				} else {
					lenis.start();
				}
			} ).observe( toggle, { attributes: true, attributeFilter: [ 'aria-expanded' ] } );
		}
	}

	/* 3. Split text into letters ------------------------------------------
	 * Screen readers must still read the normal text, so we keep a hidden
	 * copy (.screen-reader-text) and hide the letters with aria-hidden. */
	function splitText( el ) {
		if ( el.classList.contains( 'is-split' ) ) {
			return;
		}
		var label = el.textContent.replace( /\s+/g, ' ' ).trim();
		var visual = document.createElement( 'span' );
		visual.setAttribute( 'aria-hidden', 'true' );
		Array.prototype.slice.call( el.childNodes ).forEach( function ( node ) {
			visual.appendChild( splitNode( node ) );
		} );
		el.textContent = '';
		// Decorative text (aria-hidden) needs no copy for screen readers.
		if ( el.getAttribute( 'aria-hidden' ) !== 'true' ) {
			var sr = document.createElement( 'span' );
			sr.className = 'screen-reader-text';
			sr.textContent = label;
			el.appendChild( sr );
		}
		el.appendChild( visual );
		el.classList.add( 'is-split' );
	}

	// Japanese line breaking (kinsoku): these never start a line, and these
	// never end one. Each letter is its own inline-block, which turns those
	// rules off, so they are kept in the same span as their neighbour.
	var NO_LINE_START = /[、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;
	var NO_LINE_END = /[（「『【〔〈《]/;
	// A phrase ends after these (or at a space). Letters of one phrase sit in
	// an inline-block, so a line breaks between phrases ("まちに出かける、" /
	// "ホテル。"), and inside one only when it is wider than the line.
	var PHRASE_END = /[、。，．！？]/;

	// Text nodes become one <span> per letter, grouped by phrase; elements
	// (<em>, <br>, <span>) are copied and their children split the same way.
	function splitNode( node ) {
		if ( node.nodeType === 3 ) {
			var frag = document.createDocumentFragment();
			var text = node.textContent.replace( /\s+/g, ' ' );
			var phrase = null;
			var last = null;
			var open = '';
			Array.from( text ).forEach( function ( ch ) {
				if ( ch === ' ' ) {
					frag.appendChild( document.createTextNode( ' ' ) );
					phrase = null;
					last = null;
					return;
				}
				if ( last && NO_LINE_START.test( ch ) ) {
					last.textContent += ch;
					if ( PHRASE_END.test( ch ) ) {
						phrase = null;
					}
					return;
				}
				if ( NO_LINE_END.test( ch ) ) {
					open += ch;
					return;
				}
				if ( ! phrase ) {
					phrase = document.createElement( 'span' );
					phrase.className = 'split-phrase';
					frag.appendChild( phrase );
				}
				var span = document.createElement( 'span' );
				span.className = 'split-char';
				span.textContent = open + ch;
				open = '';
				phrase.appendChild( span );
				last = span;
			} );
			return frag;
		}
		var copy = node.cloneNode( false );
		Array.prototype.slice.call( node.childNodes ).forEach( function ( child ) {
			copy.appendChild( splitNode( child ) );
		} );
		return copy;
	}

	function charsOf( el ) {
		return el.querySelectorAll( '.split-char' );
	}

	function animateChars( el, delay ) {
		return gsap.fromTo(
			charsOf( el ),
			{ yPercent: 110, opacity: 0, rotate: 4 },
			{ yPercent: 0, opacity: 1, rotate: 0, duration: 1.3, ease: EASE, stagger: 0.035, delay: delay || 0 }
		);
	}

	/* 2. Opening curtain + hero ------------------------------------------ */
	function intro() {
		var hero = document.querySelector( '.hero' );
		if ( ! hero ) {
			return;
		}
		var tl = gsap.timeline();
		var curtain = document.querySelector( '.intro-curtain' );

		if ( root.classList.contains( 'intro' ) && curtain ) {
			tl.from( '.intro-curtain__line', { scaleY: 0, duration: 0.9, ease: 'power3.inOut' } )
				// scale + opacity only: animating letter-spacing would re-layout the
				// page on every frame, and a blur filter is slow to draw.
				.from( '.intro-curtain__name', { opacity: 0, scale: 1.12, duration: 1.2, ease: EASE }, '-=0.3' )
				.to( curtain, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '+=0.25' )
				.add( function () {
					root.classList.remove( 'intro' );
					gsap.set( curtain, { clearProps: 'all' } );
				} );
		}

		// Hero text: each line slides out of its mask, then the rest fades up.
		// Whole lines (4 elements), not single letters: cheaper while the
		// page is still loading.
		tl.to( hero.querySelectorAll( '.hero__line > *' ), { y: 0, duration: 1.4, ease: EASE, stagger: 0.14 }, root.classList.contains( 'intro' ) ? '-=0.6' : 0 );
		tl.to( hero.querySelectorAll( '.hero__title-line > span' ), { y: 0, duration: 1.6, ease: EASE, stagger: 0.2 }, '<0.2' );
		tl.to( hero.querySelectorAll( '[data-hero-in]' ), { opacity: 1, y: 0, duration: 1.2, ease: EASE, stagger: 0.12 }, '<0.3' );
		tl.from( '.hero__bar', { opacity: 0, duration: 1.2 }, '<0.3' );

		// The hero photo drifts down and darkens a little as you scroll away.
		gsap.to( '.hero__slides', {
			yPercent: 18,
			ease: 'none',
			scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
		} );
		gsap.to( '.hero__inner', {
			yPercent: -20,
			opacity: 0,
			ease: 'none',
			scrollTrigger: { trigger: hero, start: '30% top', end: 'bottom top', scrub: true },
		} );
	}

	/* 4. Reveals ------------------------------------------------------------ */
	function reveals() {
		// One IntersectionObserver watches everything that animates in once.
		// It is much cheaper than one ScrollTrigger per element (no layout
		// measuring while the page loads). GSAP still does the animation.
		var queue = [];
		var queued = false;

		// Elements that enter together animate together, with a small stagger.
		function flush() {
			queued = false;
			var fades = queue.filter( function ( el ) {
				return el.kind === 'fade';
			} ).map( function ( el ) {
				return el.node;
			} );
			if ( fades.length ) {
				gsap.to( fades, { opacity: 1, y: 0, duration: 1.2, ease: EASE, stagger: 0.1, overwrite: true } );
			}
			queue.forEach( function ( item ) {
				if ( item.kind === 'mask' ) {
					revealMask( item.node );
				} else if ( item.kind === 'split' ) {
					splitAndAnimate( item.node );
				}
			} );
			queue = [];
		}

		var pending = [];

		function show( el ) {
			observer.unobserve( el );
			pending.splice( pending.indexOf( el ), 1 );
			queue.push( { node: el, kind: el.ubestayKind } );
			if ( ! queued ) {
				queued = true;
				window.requestAnimationFrame( flush );
			}
		}

		var observer = new IntersectionObserver( function ( entries ) {
			entries.forEach( function ( entry ) {
				if ( entry.isIntersecting ) {
					show( entry.target );
				}
			} );
		}, { rootMargin: '0px 0px -8% 0px' } );

		// Safety net: a fast flick or a jump link can skip over an element
		// between two checks. When scrolling stops, show everything that is
		// already above the bottom of the screen.
		var timer;
		window.addEventListener( 'scroll', function () {
			clearTimeout( timer );
			timer = setTimeout( function () {
				pending.slice().forEach( function ( el ) {
					if ( el.getBoundingClientRect().top < window.innerHeight ) {
						show( el );
					}
				} );
			}, 200 );
		}, { passive: true } );

		function watch( selector, kind ) {
			document.querySelectorAll( selector ).forEach( function ( el ) {
				if ( el.closest( '.hero' ) || el.ubestayKind ) {
					return;
				}
				el.ubestayKind = kind;
				pending.push( el );
				observer.observe( el );
			} );
		}

		// Text split into letters only when it is about to be seen.
		watch( '[data-split], .section-heading__title, .section-heading__en, .page-header__en', 'split' );
		watch( '[data-reveal="mask"]', 'mask' );
		watch( '[data-reveal]:not([data-reveal="mask"]):not([data-hero-in]), :is(.room-grid, .plan-grid, .news-list, .facility-list, .route-list, .spec-list) > *, .page-header__title, .page-header__lead', 'fade' );
	}

	function splitAndAnimate( el ) {
		splitText( el );
		gsap.set( el, { opacity: 1, y: 0 } );
		animateChars( el );
	}

	// Photos uncovered from the bottom, while zooming out slightly.
	function revealMask( el ) {
		var img = el.querySelector( 'img' );
		var tl = gsap.timeline();
		tl.to( el, { clipPath: 'inset(0% 0 0 0)', duration: 1.6, ease: 'expo.inOut' } );
		if ( img && ! el.hasAttribute( 'data-parallax' ) ) {
			tl.from( img, { scale: 1.25, duration: 2, ease: EASE }, 0 );
		}
	}

	/* 5. Parallax ------------------------------------------------------------ */
	function parallax() {
		document.querySelectorAll( '[data-parallax]' ).forEach( function ( el ) {
			var img = el.querySelector( 'img' );
			if ( ! img ) {
				return;
			}
			// The photo is 120% of the frame: the extra is 1/6 of the photo.
			// Move it from "extra hidden at the top" to "extra hidden at the bottom".
			gsap.fromTo(
				img,
				{ yPercent: -100 / 6 },
				{ yPercent: 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } }
			);
		} );
	}

	/* 6. Rooms: sideways gallery ------------------------------------------- */
	function roomGallery() {
		var section = document.querySelector( '[data-hscroll]' );
		if ( ! section ) {
			return;
		}
		var track = section.querySelector( '[data-hscroll-track]' );
		var cards = track.children;

		// Cards fade up when the section arrives (all screen sizes).
		gsap.from( cards, {
			opacity: 0,
			x: 80,
			duration: 1.4,
			ease: EASE,
			stagger: 0.12,
			scrollTrigger: { trigger: section, start: 'top 75%', once: true },
		} );

		// Desktop only: pin the section and move the cards sideways.
		// On phones people swipe the row themselves (scroll-snap in CSS).
		gsap.matchMedia().add( '(min-width: 961px)', function () {
			function distance() {
				return Math.max( 0, track.scrollWidth - window.innerWidth );
			}
			if ( distance() < 40 ) {
				return undefined; // Everything fits: nothing to scroll.
			}
			section.classList.add( 'is-pinned' );
			var tween = gsap.to( track, {
				x: function () {
					return -distance();
				},
				ease: 'none',
				scrollTrigger: {
					trigger: section.querySelector( '.rooms__pin' ),
					start: 'top top',
					end: function () {
						return '+=' + distance();
					},
					pin: true,
					scrub: 0.8,
					invalidateOnRefresh: true,
				},
			} );
			return function () {
				tween.scrollTrigger.kill();
				tween.kill();
				gsap.set( track, { clearProps: 'transform' } );
				section.classList.remove( 'is-pinned' );
			};
		} );
	}
} )();
