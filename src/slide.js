/**
 * Slide directive
 */
.directive('slide', [ '$timeout', function($timeout) {
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
        var ratio       = elem.className.match(/(?:^|\s)preserve-ratio-(\d+)(?:$|\s)/);
        if(ratio !== null) {
            this.preserveRatio = parseInt(ratio[1]) / 100;
        }

        this.handlers   = {
            onResize: function(e) {
                that.resize();
            },
            register: function() {
                that.slide.$scope.$on('stageResize', this.onResize)
            }
        }
        this.handlers.register();
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
                if(this.preserveRatio !== null && ratio_width < tmp_objWidth) {
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
                    this.elem.style.width   = tmp_objWidth  + 'px';
                    this.elem.style.height  = tmp_objHeight + 'px';
                    objectWidth     = tmp_objWidth;
                    objectHeight    = tmp_objHeight;
                    this.reset();
                }
            // else scale down
            } else if(tmp_objWidth < objectWidth || (ratio_width !== null && ratio_width < objectWidth)) {
                // respect preserve-ratio values 
                if(this.preserveRatio !== null && ratio_width < tmp_objWidth) {
                    tmp_objWidth    = ratio_width;
                    tmp_objHeight   = ratio_height;
                }

                this.elem.style.width   = tmp_objWidth  + 'px';
                this.elem.style.height  = tmp_objHeight + 'px';
                objectWidth     = tmp_objWidth;
                objectHeight    = tmp_objHeight;
                this.reset();
            }
            // return an object with the current dimensions
            return { 'width': objectWidth, 'height': objectHeight };
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
            imageLoaded: function(elem) {
                // add the element to the dom for correct dimensions measuring
                that.elem.appendChild(elem);
                // register slideobject
                that.objects.push( new SlideObject( that, elem) );
                // if no other objects are to be loaded, consider the slide fully loaded
                if(--that.loading === 0) {
                    $timeout(function() {
                        // add slide to the scope
                        that.$scope.controller.addSlide( that );
                        // and emit the slideLoaded event to the scope
                        that.$scope.$emit('slideLoaded', that.index);
                    });
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

    return {
        restrict: 'E',
        require: '^slideshow',
        controller: [ '$scope', function($scope) {

        }],
        compile: function(elem, attrs) {
            return {
                pre: function(scope, elem, attrs, ctrl) {
                    // instantiate slide object
                    new Slide(scope, elem[0]);
                },
                post: function(scope, elem, attrs, ctrl) {
                }
            }
        }
    };
}]);