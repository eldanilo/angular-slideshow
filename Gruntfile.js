module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                seperator: '\n',
                sourceMap: true
            },
            dist: {
                src: [ 'src/slideshow.js', 'src/slide.js' ],
                dest: 'build/<%= pkg.name %>.js'
            }
        },
        uglify: {
            options: {
                banner: '// <%= pkg.name %> - version <%= pkg.version %> - copyright (c) 2015 by Daniel Schlessmann <info@eldanilo.de>\n// License: http://www.opensource.org/licenses/mit-license.php\n',
                sourceMap: true,
                sourceMapIncludeSources: true,
                sourceMapIn: 'build/<%= pkg.name %>.js.map'
            },
            dist: {
                src: '<%= concat.dist.dest %>',
                dest: 'build/<%= pkg.name %>.min.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.registerTask('default', ['concat', 'uglify']);
};