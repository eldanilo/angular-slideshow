'use strict';

/**
 * angularJS slideshow directive
 *
 * Copyright (c) 2015 by Daniel Schlessmann <info@eldanilo.de>
 * License: http://www.opensource.org/licenses/mit-license.php
 * 
 */
angular.module('slideshow', []).directive('slideshow', [ '$compile', '$http', '$timeout', '$location', function($compile, $http, $timeout, $location) {
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
            clearTimer: function() {
            },
            startTimer: function() {
            },
            /**
             * Moves the slide with index idx into the stage
             * @param  {integer}    idx         slide-index to move
             * @param  {boolean}    animate     if the moving should be animated
             * @return {true}       true, if the slide was moved successfully
             */
            loadSlide:  function( idx, animate ) {
                if(!this.active) {
                    that.animator.active    = true;
                    // stop autoswitching
                    this.clearTimer();
                    // reset slide
                    that.$scope.slides[idx].reset();

                    if(!animate) {
                        that.$scope.slides[idx].elem.style.left = 0;
                        that.$scope.slides[idx].show();
                    } else {

                    }

                    this.startTimer();                    
                    this.current = idx;
                    this.active = false;
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
.directive('slide', [ '$timeout', '$http', '$location', function($timeout, $http, $location) {
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
    /**
     * Resets the SlideObject (position, opacity, ...) to the initial state
     * @return {void}
     */
    SlideObject.prototype.reset = function() {
        if(JustJS.dom.hasClass(this.elem, 'center')) {
            this.elem.style.marginTop   = -Math.ceil( JustJS.dom.outerHeight(this.elem) / 2 ) + 'px';
            this.elem.style.marginLeft  = -Math.ceil( JustJS.dom.outerWidth(this.elem) / 2 ) + 'px'; 
        }
    };
    /**
     * Resizes the slide object proportionally if the stage is smaller / bigger
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
                    this.reset();
                }
            // else scale down
            } else if(tmp_objWidth < objectWidth || (ratio_width !== null && ratio_width < objectWidth)) {
                // respect preserve-ratio values 
                if(this.preserveRatio !== false && ratio_width < tmp_objWidth) {
                    tmp_objWidth    = ratio_width;
                    tmp_objHeight   = ratio_height;
                }
                this.updateSize(tmp_objWidth, tmp_objHeight);
                this.reset();
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

        this.animator   = {
        };

        this.handlers   = {
            emitLoaded: function() {
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

        // create slide objects
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
     * Resets the slide back to its initial state by calling reset on the slide objects
     * 
     * @return {void}
     */
    Slide.prototype.reset = function() {
        for(var i = 0; i < this.objects.length; i++) {
            this.objects[i].reset();
        }
    };
    Slide.prototype.show = function() {};
    Slide.prototype.resize = function() {
        for(var i = 0; i < this.objects.length; i++) {
            this.objects[i].resize();
        }
    };

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