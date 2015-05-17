'use strict';

/**
 * angularJS slideshow directive
 *
 * Copyright (c) 2015 by Daniel Schlessmann <info@eldanilo.de>
 * License: http://www.opensource.org/licenses/mit-license.php
 * 
 */
angular.module('slideshow', []).directive('slideshow', [ '$compile', '$http', '$timeout', '$q', '$location', function($compile, $http, $timeout, $q, $location) {
    /**
     * Slideshow
     *
     * @param {object}      elem            DOM element for the slideshow
     */
    var Slideshow = function( scope, elem ) {
        // save reference to this into that
        var that    = this;

        // properties
        this.$scope     = scope;
        this.elem       = elem;

        /**
         * Slideshow.handlers
         *
         * Responsible for handling events
         * 
         * @type {object}
         */
        this.handlers = {
            onOrientationChange: function(e) {
                that.handlers.onResize(e);
            },
            onResize: function(e) {
                // call resize() on all slides
                for(var i = 0; i < that.$scope.slides.length; ++i) {
                    // but only the ones represented by an actual slide object
                    if(typeof that.$scope.slides[i].resize === 'function') {
                        that.$scope.slides[i].resize();
                        // adjust slides positions
                        that.$scope.slides[i].elem.style.left = (i !== that.animator.current ? -JustJS.dom.innerWidth(that.elem) : 0) + 'px';
                    }
                }
            },
            register: function() {
                if(typeof window.orientation !== 'undefined') {
                    window.addEventListener('orientationchange', this.onOrientationChange);
                } else {
                    window.addEventListener('resize', this.onResize);
                }
            }
        };
        this.handlers.register();

        /**
         * Slideshow.animator
         *
         * This is where most of the animation magic happens
         * 
         * @type {object}
         */
        this.animator = {
            // index of the currently displayed slide
            current:    null,
            // indicates if the slideshow is currently animating
            active:     false,
            // holds a promise to the function that prodivdes autoswitching
            timer:      null,
            startTimer: function() {
                this.timer = $timeout(function() {
                    var current = that.animator.current;
                    var next    = (current < that.$scope.slides.length - 1) ? ++current : 0;
                    that.animator.loadSlide( next, true );
                }, 3000);
            },
            /**
             * Moves the slide with index idx into the stage
             * 
             * @param  {integer}    idx         slide-index to move
             * @param  {boolean}    animate     if the moving should be animated
             * @return {true}       true, if the slide was moved successfully
             */
            loadSlide:  function( idx, animate ) {
                if(!this.active) {
                    // set as active
                    that.animator.active    = true;
                    // save slide references
                    var current = that.$scope.slides[this.current];
                    var next    = that.$scope.slides[idx];
                    // save stageWidth
                    var stageWidth = JustJS.dom.innerWidth( that.elem );

                    // skip if slide is already in the stage
                    if(next.elem.style.left === 0) {
                        return;
                    }

                    current.hide().then(function() {
                        var tmp = $q.defer();
                        var callback = function() {
                            current.elem.style.left = '';
                            JustJS.dom.removeClass(current.elem, 'active');
                            that.animator.current   = idx; 
                            JustJS.dom.addClass(next.elem, 'active');
                            tmp.resolve();
                        }
                        if(!animate) {
                            callback();
                            next.elem.style.left = '0px';
                        } else {
                            next.elem.style.left = stageWidth + 'px';
                            JustJS.fx.animate(current.elem, { left: '-='+stageWidth }, { duration: 650, easing: 'inQuad' });
                            JustJS.fx.animate(next.elem, { left: '-='+stageWidth }, { duration: 650, easing: 'inQuad', complete: callback });
                        }
                        return tmp.promise;
                    }).then(function() {
                        return next.show();
                    }).then(function() {
                        that.animator.startTimer();
                        that.animator.active = false;
                    });
                }
            },
            handlers:   {
                slideLoaded: function(e, idx) {
                    if(idx === that.animator.current) {
                        that.animator.loadSlide( idx );
                    }
                },
                register: function() {
                    that.$scope.$on('slideLoaded', this.slideLoaded);
                }
            },
        };
        this.animator.handlers.register();

        // create slides
        if(scope.slides && scope.slides.length > 0) {
            // initialize with the first slide
            this.animator.current = 0;
            for(var i = 0; i < scope.slides.length; ++i) {
                var slide = document.createElement('slide');
                slide.setAttribute('data-slide-index', i);
                elem.appendChild(slide);
                $compile(slide)(scope);
            }
        }
    };
    Slideshow.prototype.destroy = function() {
        $timeout.cancel(this.animator.timer);
        // call 'destroy' of slides
        for(var i = 0; i < this.$scope.slides.length; ++i) {
            this.$scope.slides[i].destroy();
        }
    };

    return {
        restrict: 'E',    
        controller: [ '$scope', function($scope) {
            // save controller reference into our isolated scope
            $scope.controller = this;
            // will reference to the slideshow instance later
            $scope.slideshow  = null;
            // save slides into the scope, when they are fully loaded. we do this by
            // replacing the elements in the slides array with their *real* counterpart
            this.addSlide = function( object ) {
                if(typeof object.index !== 'undefined') { 
                    $scope.slides[object.index] = object;
                }
            };
        }],
        compile: function(elem, attrs) {
            return {
                pre: function(scope, elem, attrs, ctrl) {
                    // instantiate slideshow object
                    scope.slideshow = new Slideshow( scope, elem[0] );
                    scope.$on('$destroy', function() {
                        scope.slideshow.destroy();
                    });
                },
                post: function(scope, elem, attrs, ctrl) {
                }
            }
        },
        scope: {
            slides: '='
        }
    };
}])
/**
 * Slide directive
 */
.directive('slide', [ '$timeout', '$http', '$location', '$q', function($timeout, $http, $location, $q) {
    /**
     * SlideObject
     *
     * SlideObjects are the objects within a Slide
     * 
     * @param {Slide}       slide           Reference to the slide containing this object
     * @param {object}      elem            DOM element for the object
     */
    var SlideObject = function( slide, elem ) {
        // save reference of this into that
        var that = this;

        // properties
        this.slide      = slide;
        this.elem       = elem;
        this.isSVG      = elem.nodeName.toLowerCase() === 'svg' ? true : false;
        this.isLoading  = true;
        // initial dimensions
        this.width      = JustJS.dom.outerWidth(elem);
        this.height     = JustJS.dom.outerHeight(elem);
        // test for preserve ratio class
        this.preserveRatio = false;
        var ratio       = (typeof elem.className === 'string' ? elem.className.match(/(?:^|\s)preserve-ratio-(\d+)(?:$|\s)/) : null);
        if(ratio !== null) {
            this.preserveRatio = parseInt(ratio[1]) / 100;
        }

        this.handlers   = {
            register: function() {
            }
        }
        this.handlers.register();
        // resize
        this.resize();
    };
    SlideObject.prototype.updateSize = function(w, h) {
        if(this.isSVG) {
            this.elem.setAttribute('width', w +'px');
            this.elem.setAttribute('height', h +'px');
        } else {
            this.elem.style.width   = w +'px';
            this.elem.style.height  = h + 'px';
        }
    };
    SlideObject.prototype.adjustPosition = function() {
        // adjust object position
        if(JustJS.dom.hasClass(this.elem, 'center')) {
            this.elem.style.marginTop   = -Math.ceil( JustJS.dom.outerHeight(this.elem) / 2 ) + 'px';
            this.elem.style.marginLeft  = -Math.ceil( JustJS.dom.outerWidth(this.elem) / 2 ) + 'px'; 
        }
    };
    /**
     * Resets the SlideObject (position, opacity, ...) to its initial state
     * 
     * @return {void}
     */
    SlideObject.prototype.reset = function() {
        // clean up
        this.adjustPosition();
        // hide 'fade-in' elements
        var nodes = this.elem.querySelectorAll('.fade-in');
        for(var i = 0; i < nodes.length; i++) {
            nodes[i].style.display = 'none';
        }
        if(this.isSVG) {
            // hide slide-in elements in svgs
            var nodes = this.elem.querySelectorAll('.slide-in');
            for(var i = 0; i < nodes.length; i++) {
                var bbox = nodes[i].getBBox();
                // move node to the exact position
                var translate = [ 0, 0 ];
                switch( nodes[i].getAttribute('data-animation-slide-from') ) {
                    case 'top':
                        translate = [ 0, -Math.ceil((bbox.y + bbox.height+50)) ];
                    break;
                    case 'right':
                        translate = [ Math.ceil(this.width - bbox.x),  0 ];
                    break;
                    case 'bottom':
                    break;
                    case 'left':
                    default:
                }
                var next        = 'translate('+translate[0]+(translate[1] !== 0 ? ' ' + translate[1] : '')+')';
                var rawValue    = nodes[i].getAttribute('transform');
                if(rawValue && rawValue.length > 0 ) {
                    var old = rawValue.match(/translate\((-?\d+(\.\d+)?)(px)?(([\,\s])(-?\d+)(\.\d+)?(px)?)?\)/i);
                    nodes[i].setAttribute('transform', (old ? rawValue.replace( old[0], next ) : rawValue + ' ' + next));
                } else {
                    nodes[i].setAttribute('transform', next );
                }
            }
            // remove translate to reset elements to their initial position
            var nodes = this.elem.querySelectorAll('.translate');
            for(var i = 0; i < nodes.length; i++) {
                nodes[i].removeAttribute('transform');
            }
        }
    };
    /**
     * Resizes the slide object proportionally if the stage is smaller / bigger
     * 
     * @return {void}
     */
    SlideObject.prototype.resize = function() {
        if(typeof this.slide.$scope.slideshow !== null) {
            var slideshow = this.slide.$scope.slideshow;
            // get stage dimensions
            var stageWidth  = JustJS.dom.innerWidth( slideshow.elem );
            var stageHeight = JustJS.dom.innerHeight( slideshow.elem );
            // get current object dimentions
            var objectWidth = JustJS.dom.outerWidth( this.elem );
            var objectHeight = JustJS.dom.outerHeight( this.elem );
            // calculate transformations
            var transform_x = stageWidth / objectWidth;
            var transform_y = stageHeight / objectHeight;
            // calculate temporary dimensions
            var tmp_objWidth = Math.ceil(objectWidth * (transform_x < transform_y ? transform_x : transform_y));
            var tmp_objHeight= Math.ceil(objectHeight * (transform_x < transform_y ? transform_x : transform_y));
            // calculate ratio dimensions
            var ratio_width  = null;
            var ratio_height = null; 
            if(this.preserveRatio !== false) {
                ratio_width     = Math.ceil(stageWidth * this.preserveRatio);
                ratio_height    = Math.ceil(ratio_width * (this.height/this.width));
            }

            // scale up 
            if(tmp_objWidth > objectWidth && (ratio_width !== null ? (ratio_width > objectWidth) : true)) {
                // respect preserve-ratio values 
                if(this.preserveRatio !== false && ratio_width < tmp_objWidth) {
                    tmp_objWidth    = ratio_width;
                    tmp_objHeight   = ratio_height;
                }
                // we dont want to scale bigger than the original
                if(tmp_objWidth > this.width) {
                    tmp_objWidth  = this.width;
                    tmp_objHeight = this.height;
                }
                // and only when the object isn't already at full size
                if(objectWidth < this.width) {
                    this.updateSize(tmp_objWidth, tmp_objHeight);
                    this.adjustPosition();
                }
            // scale down
            } else if(tmp_objWidth < objectWidth || (ratio_width !== null && ratio_width < objectWidth)) {
                // respect preserve-ratio values 
                if(this.preserveRatio !== false && ratio_width < tmp_objWidth) {
                    tmp_objWidth    = ratio_width;
                    tmp_objHeight   = ratio_height;
                }
                this.updateSize(tmp_objWidth, tmp_objHeight);
                this.adjustPosition();
            }
        } else {
            console.log('Slideshow: no valid slideshow instance present to perform resize.')
        }
    };

    /**
     * Slide
     *
     * Part of a Slideshow and contains various SlideObjects itself
     * 
     * @param {Slideshow}   slideshow       Reference to the Slideshow
     * @param {integer}     idx             Index of the slide
     * @param {object}      elem            DOM element for the slide
     */
    var Slide = function( scope, elem ) {
        // save reference for this into that
        var that = this;

        // properties
        this.$scope     = scope;
        this.elem       = elem;
        this.index      = elem.hasAttribute('data-slide-index') && /^\d+$/.test(elem.getAttribute('data-slide-index')) ? parseInt(elem.getAttribute('data-slide-index')) : null;
        this.objects    = [];
        this.loading    = 0;

        /**
         * Slide.animator
         *
         * Responsible for animations within the slide
         * 
         * @type {Object}
         */
        this.animator   = {
            running:    0,
            deferred:    null,
            animations: [],
            show: function() {
                // this could be changed to append the call to a already running function call
                if(that.animator.deferred === null) {
                    // save promise for this function call
                    that.animator.deferred = $q.defer();
                    // find nodes that should be animated
                    var nodes = that.elem.querySelectorAll('.animate');
                    if(nodes.length > 0) {
                        // every animation will call the callback when completed
                        // if all animations have ended, resolve the promise
                        var callback = function() {
                            --that.animator.running;
                            if(that.animator.running === 0) {
                                that.animator.deferred.resolve();
                                that.animator.deferred = null;
                            }
                        };
                        // internal counter to save promises of the animations
                        var animated = 0;
                        // lets roll
                        for(var i = 0; i < nodes.length; i++) {
                            // fade in
                            if( JustJS.dom.hasClass( nodes[i], 'fade-in') ) {
                                that.animator.running++;
                                (function( node, duration, delay ) {
                                    that.animator.animations[animated++] = $timeout(function() {
                                        JustJS.fx.fadeIn( node, { duration: (duration > 0 ? duration : 700), complete: callback });
                                    }, delay);
                                })( nodes[i], parseInt( nodes[i].getAttribute('data-animation-duration'), 10 ), parseInt( nodes[i].getAttribute('data-animation-delay'), 10 ) );
                            }
                            // slide in
                            if( JustJS.dom.hasClass( nodes[i], 'slide-in') ) {
                                that.animator.running++;
                                (function( node, duration, delay ) {
                                    that.animator.animations[animated++] = $timeout(function() {
                                        JustJS.fx.transform( 
                                            node, { 
                                                translate: { x: 0, y: 0 } 
                                            },{ 
                                                duration: (duration > 0 ? duration : 700), 
                                                easing: 'backIn',
                                                useAttributes: true, 
                                                complete: callback 
                                            }
                                        );
                                    }, delay);
                                })( nodes[i], parseInt( nodes[i].getAttribute('data-animation-duration'), 10 ), parseInt( nodes[i].getAttribute('data-animation-delay'), 10 ) );
                            }
                            // move
                            if( JustJS.dom.hasClass(nodes[i], 'translate') ) {
                                that.animator.running++;
                                (function( node, duration, delay ) {
                                    var x = parseInt(node.getAttribute('data-animation-translate-x'));
                                    var y = parseInt(node.getAttribute('data-animation-translate-y'));

                                    that.animator.animations[animated++] = $timeout(function() {
                                        JustJS.fx.transform( 
                                            node, { 
                                                translate: { x: (x ? x : 0), y: (y ? y : 0) } 
                                            },{ 
                                                duration: (duration > 0 ? duration : 700), 
                                                easing: 'inQuad',
                                                useAttributes: true, 
                                                complete: callback 
                                            }
                                        );
                                    }, delay);
                                })( nodes[i], parseInt( nodes[i].getAttribute('data-animation-duration'), 10 ), parseInt( nodes[i].getAttribute('data-animation-delay'), 10 ) );
                            }
                        }
                    } else {
                        $timeout(function() {
                            that.animator.deferred.resolve();
                            that.animator.deferred = null;
                        });
                    }
                    return that.animator.deferred.promise;
                }
            },
            hide: function() {
                var deferred = $q.defer();
                $timeout(function() {
                    for(var i = 0; i < that.objects.length; i++) {
                        that.objects[i].reset();
                    }
                    deferred.resolve();
                });
                return deferred.promise;
            },
            reset: function() {
                var deferred = $q.defer();
                $timeout(function() {
                    for(var i = 0; i < that.objects.length; i++) {
                        that.objects[i].reset();
                    }
                    deferred.resolve();
                });
                return deferred.promise;
            }
        };

        this.handlers   = {
            emitLoaded: function() {
                // reset the slide
                that.reset();
                $timeout(function() {
                    // add slide to the scope
                    that.$scope.controller.addSlide( that );
                    // and emit the slideLoaded event to the scope
                    that.$scope.$emit('slideLoaded', that.index);
                });
            },
            imageLoaded: function(elem) {
                // add the element to the dom for correct dimensions measuring
                that.elem.appendChild(elem);
                // register slideobject
                that.objects.push( new SlideObject( that, elem) );
                // if no other objects are to be loaded, consider the slide fully loaded
                if(--that.loading === 0) {
                    that.handlers.emitLoaded();
                }
            },
            svgLoaded: function(original, index) {
                // create new svg element
                var svg = document.createElement('svg');
                svg.id = 'svg-'+index;
                // make the svg standards compliant
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                // copy attributes
                svg.setAttribute('width',  original.getAttribute('width'));
                svg.setAttribute('height', original.getAttribute('height'));
                svg.setAttribute('viewBox',original.getAttribute('viewBox'));
                // parse the nodes of the original                
                if(original && original.childNodes.length > 0) {
                    var i = 0;
                    while( i < original.childNodes.length ) {
                        // we only want element nodes
                        if(original.childNodes[i].nodeType === 1) {
                            // fix clip paths
                            if(original.childNodes[i].style.clipPath && original.childNodes[i].style.clipPath !== '') {
                                var path = original.childNodes[i].style.clipPath.match(/url\([\"\']?\#([^"')]+)["']?\)/);
                                if(path) {
                                    original.childNodes[i].style.clipPath = 'url('+$location.url()+'#'+path[1]+')';
                                }
                            }
                            // ... and append the node to the new svg
                            svg.appendChild( original.childNodes[i] );
                        } else {
                            i++;
                        }
                    }
                }
                // fix paths in url()
                var nodes = svg.querySelectorAll('[fill^=url]');
                for(var i = 0; i < nodes.length; ++i) {
                    var path = nodes[i].getAttribute('fill').match(/url\([\"\']?\#([^"')]+)["']?\)/);
                    if(path) {
                        nodes[i].setAttribute('fill', 'url('+$location.url()+'#'+path[1]+')');
                    }
                }
                // ugly workaround, to get firefox to actually render the svg correctly
                that.elem.innerHTML += svg.outerHTML;
                svg = that.elem.querySelector('#svg-'+index);
                if(svg !== null) {
                    svg.id = '';
                    // now we can use the new element to create our slide object
                    that.objects.push( new SlideObject(that, svg) );
                    // if no other objects are to be loaded, consider the slide fully loaded
                    if(--that.loading === 0) {
                        that.handlers.emitLoaded();
                    }
                }
            },
            register: function() {}
        };
        this.handlers.register();

        // create slide objects...
        // objects are loaded from the scope / slide array
        if(this.index !== null && scope.slides[this.index]['objects']) {
            for(var i = 0; i < scope.slides[this.index]['objects'].length; ++i) {
                var obj = scope.slides[this.index]['objects'][i];
                switch(obj.type) {
                    // img
                    case 'img':
                        ++this.loading;
                        var img = document.createElement('img');
                        // register handler
                        img.onload = function() {
                            that.handlers.imageLoaded(img);
                        }
                        // set attributes
                        img.alt = obj.alt;
                        img.className = obj.classes;
                        img.src = obj.src;
                    break;
                    // svg
                    case 'svg':
                    ++this.loading;
                    // we load the svg content via http and build our own inline svg
                    (function(obj, index) {
                        $http.get(obj.src, { cache: true }).success(function(data) {
                            // remove unnecessary elements
                            data = data.replace(/\<\?xml(.*?)\?\>|\<\!--(.*?)--\>|\<\!DOCTYPE([^\>]+)\>/ig, '').replace(/^\s+|\s+$/g, '');
                            // let the browser parse the data
                            var tmp = document.createElement('div');
                            tmp.innerHTML = data;
                            // extract the original contents
                            var original = tmp.querySelector('svg');
                            // call the imageLoaded handler
                            if(original !== null) {
                                $timeout(function() {
                                    that.handlers.svgLoaded(original, index);
                                });
                            }
                        });
                    })(obj, i);

                    break;
                }
            }
        }
    };
    /**
     * Resets the slide back to its initial state
     * 
     * @return {promise}
     */
    Slide.prototype.reset = function() {
        return this.animator.reset();
    };
    /**
     * Shows the Slide
     *
     * @return {promise} 
     */
    Slide.prototype.show = function() {
        return this.animator.show();
    };
    /**
     * Hides the Slide
     *
     * This function can be used to implement a hide-animation in the future.
     * 
     * @return {promise}
     */
    Slide.prototype.hide = function() {
        return this.animator.hide();
    }
    /**
     * Resize the Slide
     * 
     * @return {void}
     */
    Slide.prototype.resize = function() {
        for(var i = 0; i < this.objects.length; i++) {
            this.objects[i].resize();
        }
    };
    /**
     * Destroys the Slide
     * 
     * @return {void}
     */
    Slide.prototype.destroy = function() {
        for(var i = 0; i < this.animator.animations.length; i++) {
            if(this.animator.animations[i]) {
                $timeout.cancel( this.animator.animations[i] );
            }
        }
    }

    return {
        restrict: 'E',
        require: '^slideshow',
        controller: [ '$scope', function($scope) {

        }],
        compile: function(elem, attrs) {
            return {
                pre: function(scope, elem, attrs, ctrl) {
                },
                post: function(scope, elem, attrs, ctrl) {
                    // instantiate slide object
                    new Slide(scope, elem[0]);
                }
            }
        }
    };
}]);
//# sourceMappingURL=angular-slideshow.js.map