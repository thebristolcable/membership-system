import express from 'express';

import auth from '@core/authentication';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', function ( req, res ) {
	if ( auth.loggedIn( req ) == auth.LOGGED_IN ) {
		res.redirect( '/profile' );
	} else {
		res.render( 'index' );
	}
} );

export default function(): express.Express { return app; }