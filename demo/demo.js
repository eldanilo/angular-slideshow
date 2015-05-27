'use strict';

/**
 * AngularJS Slideshow Example Application
 */
var App = angular.module('SlideshowExampleApplication', [ 
        'slideshow'
    ]
).controller('SlideshowController', ['$scope', function($scope) {
    /**
     * svg contents are preloaded via ajax, so the request will only succeed if the server will allow the CORS.
     */
    $scope.slides = [
        {
            objects: [{
                type:       'svg',
                src:        'http://eldanilo.de/files/angular-slideshow/like-a-sir.svg',
                alt:        'Like a Sir!',
                classes:    'center'
            }]
        },{
            objects: [{
                type:       'svg',
                src:        'http://eldanilo.de/files/angular-slideshow/trollface.svg',
                alt:        ':D',
                classes:    'center'
            }]
        }
    ];
}]);