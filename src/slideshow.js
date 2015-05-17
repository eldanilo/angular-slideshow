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
                    that.animator.loadSlide( next, false );
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

                    if(!animate) {
                        // hide current slide
                        current.hide().then(function() {
                            current.elem.style.left = -stageWidth + 'px';
                            JustJS.dom.removeClass(current.elem, 'active');
                           // move next slide into stage
                            next.elem.style.left    = 0;
                            that.animator.current   = idx;
                            JustJS.dom.addClass(next.elem, 'active');
                        // show the next slide
                        }).then(function() {
                            return next.show();
                        }).then(function() {
                            that.animator.startTimer();
                            that.animator.active = false;
                        });
                    } else {

                    }
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