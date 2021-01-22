import express from 'express';

import { AppConfig } from '@core/utils';
import auth from '@core/authentication';

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use(auth.isAdmin);

app.use((req, res, next) => {
	res.locals.app = app_config;
	next();
});

app.get('/', (req, res) => {
	res.render('index');
});

export default function (config: AppConfig): express.Express {
	app_config = config;
	return app;
}
