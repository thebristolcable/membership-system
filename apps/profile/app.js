const express = require( 'express' );

const auth = require( '@core/authentication' );
const { Notices } = require( '@core/database' );
const { wrapAsync } = require( '@core/utils' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await Notices.find( { enabled: true } ); // TODO: filter for expires
	res.render( 'index', { user: req.user, notices } );
} ) );

module.exports = function( config ) {
	app_config = config;
	return app;
};
