/**
 * Ube Stay — main.js
 * Small features that work without the animation libraries, no jQuery:
 *  1. Mobile menu open/close (with aria-expanded for screen readers)
 *  2. Google Map "facade": load the real map only after a click
 *  3. Hero slideshow (with a pause button)
 *  4. Header hides when scrolling down, comes back when scrolling up
 *  5. 3D room tour: loads the 3D code only after a click
 */
( function () {
	'use strict';

	// JS is running, so remove the "no-js" fallback styles.
	document.documentElement.classList.remove( 'no-js' );

	/* 1. Mobile menu ---------------------------------------------------- */
	var toggle = document.querySelector( '.menu-toggle' );
	var nav = document.getElementById( 'site-nav' );

	function setMenu( open ) {
		if ( open ) {
			// Start the panel right under the header (the banner above it
			// may or may not be visible, depending on scroll position).
			nav.style.top = document.querySelector( '.site-header' ).getBoundingClientRect().bottom + 'px';
		}
		toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
		nav.classList.toggle( 'is-open', open );
		document.body.classList.toggle( 'menu-open', open );
	}

	if ( toggle && nav ) {
		toggle.addEventListener( 'click', function () {
			setMenu( toggle.getAttribute( 'aria-expanded' ) !== 'true' );
		} );

		// Close with the Esc key and give focus back to the button.
		document.addEventListener( 'keydown', function ( event ) {
			if ( event.key === 'Escape' && nav.classList.contains( 'is-open' ) ) {
				setMenu( false );
				toggle.focus();
			}
		} );

		// Close when a link inside the menu is clicked.
		nav.addEventListener( 'click', function ( event ) {
			if ( event.target.closest( 'a' ) ) {
				setMenu( false );
			}
		} );
	}

	/* 2. Map facade -------------------------------------------------------- */
	document.querySelectorAll( '[data-map-src]' ).forEach( function ( button ) {
		button.addEventListener( 'click', function () {
			var iframe = document.createElement( 'iframe' );
			iframe.src = button.getAttribute( 'data-map-src' );
			iframe.title = 'Google マップ';
			iframe.loading = 'lazy';
			iframe.referrerPolicy = 'no-referrer-when-downgrade';
			button.closest( '[data-map]' ).appendChild( iframe );
			iframe.focus();
		} );
	} );

	/* 3. Hero slideshow ------------------------------------------------------
	 * The progress line is a CSS animation (6 s). When it ends, we show the
	 * next photo and restart it. Pausing = pausing the CSS animation.
	 * (A CSS animation runs on the GPU; changing the line with JS on every
	 * frame kept the main thread busy and slowed the page down.) */
	var slides = document.querySelectorAll( '.hero__slide' );
	var pause = document.querySelector( '[data-hero-pause]' );
	var current = document.querySelector( '[data-hero-current]' );
	var progress = document.querySelector( '[data-hero-progress]' );
	var reduce = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	if ( slides.length > 1 && progress ) {
		var index = 0;

		// Load the other photos only after the page (and the first photo) is done.
		window.addEventListener( 'load', function () {
			document.querySelectorAll( '.hero__slide img[data-src]' ).forEach( function ( img ) {
				if ( img.dataset.srcset ) {
					img.srcset = img.dataset.srcset;
				}
				img.src = img.dataset.src;
				img.removeAttribute( 'data-src' );
			} );
		} );

		function show( next ) {
			slides[ index ].classList.remove( 'is-active' );
			index = ( next + slides.length ) % slides.length;
			slides[ index ].classList.add( 'is-active' );
			if ( current ) {
				current.textContent = String( index + 1 ).padStart( 2, '0' );
			}
		}

		function restartProgress() {
			progress.classList.remove( 'is-running' );
			void progress.offsetWidth; // Force the browser to notice, so the animation starts again.
			progress.classList.add( 'is-running' );
		}

		function setPlaying( playing ) {
			progress.classList.toggle( 'is-paused', ! playing );
			if ( pause ) {
				// The label says what the button will do (not aria-pressed too:
				// a toggle button should not also change its name).
				pause.classList.toggle( 'is-paused', ! playing );
				pause.querySelector( '.screen-reader-text' ).textContent = playing ? 'スライドショーを一時停止' : 'スライドショーを再生';
			}
		}

		progress.addEventListener( 'animationend', function () {
			show( index + 1 );
			restartProgress();
		} );

		if ( pause ) {
			pause.addEventListener( 'click', function () {
				setPlaying( progress.classList.contains( 'is-paused' ) );
			} );
		}

		restartProgress();
		setPlaying( ! reduce ); // "Reduce motion": start paused.
	}

	/* 4. Header: hide on scroll down, show on scroll up --------------------- */
	var header = document.querySelector( '.site-header' );
	var lastY = window.scrollY;
	if ( header ) {
		window.addEventListener( 'scroll', function () {
			var y = window.scrollY;
			var menuOpen = document.body.classList.contains( 'menu-open' );
			var focusInside = header.contains( document.activeElement );
			header.classList.toggle( 'is-hidden', y > lastY && y > 240 && ! menuOpen && ! focusInside );
			lastY = y;
		}, { passive: true } );
	}

	/* 5. 3D room tour: load the 3D code only when asked ----------------------
	 * The viewer (three.js) is about 150 KB compressed, so it downloads only
	 * after a click on "客室を3Dで見る". Before that, the buttons for the
	 * room types just swap the still picture.
	 */
	document.querySelectorAll( '[data-room3d]' ).forEach( function ( root ) {
		var config = JSON.parse( root.getAttribute( 'data-room3d' ) );
		var start = root.querySelector( '[data-room3d-start]' );
		var poster = root.querySelector( '.room3d__poster' );
		var status = root.querySelector( '.room3d__status' );
		var tabs = root.querySelectorAll( '[data-room3d-tab]' );
		var link = root.querySelector( '[data-room3d-link]' );
		config.index = 0;

		tabs.forEach( function ( tab ) {
			tab.addEventListener( 'click', function () {
				var i = parseInt( tab.getAttribute( 'data-room3d-tab' ), 10 );
				var room = config.rooms[ i ];
				config.index = i;
				tabs.forEach( function ( other ) {
					other.setAttribute( 'aria-pressed', other === tab ? 'true' : 'false' );
				} );
				if ( link ) {
					link.href = room.url;
					link.querySelector( '[data-room3d-link-text]' ).textContent = room.title;
				}
				if ( root.viewer ) {
					root.viewer.setRoom( i );
				} else if ( poster && room.poster ) {
					var source = root.querySelector( '.room3d__stage source' );
					if ( source && room.posterMobile ) {
						source.srcset = room.posterMobile;
					}
					poster.src = room.poster;
				}
			} );
		} );

		start.addEventListener( 'click', function () {
			if ( root.classList.contains( 'is-loading' ) ) {
				return;
			}
			root.classList.add( 'is-loading' );
			status.textContent = '3Dモデルを読み込んでいます…';

			function failed( message ) {
				root.classList.remove( 'is-loading' );
				status.textContent = message;
			}

			var script = document.createElement( 'script' );
			script.src = root.getAttribute( 'data-room3d-src' );
			script.onload = function () {
				try {
					root.viewer = window.UbeStayRoom3D.mount( root, config );
					root.classList.remove( 'is-loading' );
					root.querySelector( '.room3d__canvas' ).focus( { preventScroll: true } );
				} catch ( e ) {
					// Usually: WebGL is turned off or not supported.
					failed( 'この端末では3D表示を利用できません。' );
				}
			};
			script.onerror = function () {
				failed( '3Dモデルを読み込めませんでした。時間をおいて、もう一度お試しください。' );
			};
			document.head.appendChild( script );
		} );
	} );
} )();
