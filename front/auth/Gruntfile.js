'use strict';

module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('../../package.json'),
        banner: '/* <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %> */\n\n',

        copy: {
            auth: {
                files: [
                    { // Copy HTML
                        expand: true,
                        cwd: 'html',
                        src: '**',
                        dest: '../../public/auth/',
                    },
                    { // Copy image files
                        expand: true,
                        cwd: '.',
                        src: 'img/**',
                        dest: '../../public/auth/',
                    },
                    { // Copy translation files
                        expand: true,
                        cwd: '.',
                        src: 'l10n/**',
                        dest: '../../public/auth/',
                    },
                    { // Copy Bootstrap fonts to common assets dir
                        expand: true,
                        cwd: 'bower_components/bootstrap/dist/',
                        src: 'fonts/**',
                        dest: '../../public/auth/',
                    },
                    { // Copy CLDR main data to common assets dir
                        expand: true,
                        cwd: 'bower_components/cldr-data/',
                        src: 'main/**',
                        dest: '../../public/auth/cldr',
                    },
                    { // Copy CLDR supplemental data to common assets dir
                        expand: true,
                        cwd: 'bower_components/cldr-data/',
                        src: 'supplemental/**',
                        dest: '../../public/auth/cldr',
                    },
                ],
            },
        },

        concat: {
            options: {
                banner: '<%= banner %>',
                stripBanners: true
            },
            vendorjs: {
                src: [
                    'bower_components/jquery/dist/jquery.js',
                    'bower_components/bootstrap/dist/js/bootstrap.js',
                    'bower_components/jquery.qrcode/dist/jquery.qrcode.js',

                    'bower_components/cldrjs/dist/cldr.js',
                    'bower_components/cldrjs/dist/cldr/event.js',
                    'bower_components/cldrjs/dist/cldr/supplemental.js',

                    'bower_components/globalize/dist/globalize.js',
                    'bower_components/globalize/dist/globalize/message.js',
                    'bower_components/globalize/dist/globalize/number.js',
                    'bower_components/globalize/dist/globalize/plural.js',
                    'bower_components/globalize/dist/globalize/currency.js',
                    'bower_components/globalize/dist/globalize/date.js',
                ],
                dest: '../../public/auth/js/vendor.js'
            },
            vendorcss: {
                src: [
                    'bower_components/bootstrap/dist/css/bootstrap.css',
                    'bower_components/bootstrap/dist/css/bootstrap-theme.css',
                ],
                dest: '../../public/auth/css/vendor.css'
            },
            appjs: {
                src: 'js/**/*.js',
                dest: '../../public/auth/js/app.js',
            },
            appcss: {
                src: 'css/**/*.css',
                dest: '../../public/auth/css/app.css',
            },
        },

        uglify: {
            options: {
                banner: '<%= banner %>'
            },
            vendorjs: {
                src: '<%= concat.vendorjs.dest %>',
                dest: '../../public/auth/js/vendor.min.js'
            },
            appjs: {
                src: '<%= concat.appjs.dest %>',
                dest: '../../public/auth/js/app.min.js'
            },
        },

        cssmin: {
            options: {
                banner: '<%= banner %>'
            },
            vendorcss: {
                src: '<%= concat.vendorcss.dest %>',
                dest: '../../public/auth/css/vendor.min.css'
            },
            appcss: {
                src: '<%= concat.appcss.dest %>',
                dest: '../../public/auth/css/app.min.css'
            },
        },

        jasmine: {
            src: [
                '<%= concat.appjs.src %>'
            ],
            options: {
                vendor: [
                    '<%= concat.vendorjs.src %>',
                    'node_modules/jasmine-jquery/lib/jasmine-jquery.js'
                ],
                helpers: [
                    'test/helpers/**/*.js'
                ],
                specs: [
                    'test/specs/**/*.js'
                ],
                styles: [
                    '<%= concat.vendorcss.src %>',
                    '<%= concat.appcss.src %>'
                ],
            }
        },

        watch: {
            files: [ '**/*' ],
            tasks: ['build'],
        },
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-jasmine');

    grunt.registerTask('build', ['concat', 'uglify', 'cssmin']);
    grunt.registerTask('default', ['jasmine', 'copy', 'build']);
};
