var __root = '../../../..';
var __src = __root + '/src';
var __js = __src + '/js';
var __config = __root + '/config';

var	express = require( 'express' ),
	app = express();

var auth = require( __js + '/authentication' );

var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.parent.mountpath + app.mountpath
	} );
	res.locals.activeApp = app_config.uid;
	next();
} );

app.get( '/', auth.isLoggedIn, function( req, res ) {
	res.render( 'complete', { user: req.user } );
} );

app.post( '/', auth.isLoggedIn, function( req, res ) {
	res.redirect( '/profile' );
} );

module.exports = function( config ) {
	app_config = config;
	return app;
};
