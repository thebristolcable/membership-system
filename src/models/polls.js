const moment = require( 'moment' );
const mongoose = require( 'mongoose' );

module.exports = {
	name: 'Polls',
	schema: mongoose.Schema( {
		date: {
			type: Date,
			required: true,
			default: Date.now
		},
		formSchema: Object,
		question: {
			type: String,
			required: true
		},
		slug: {
			type: String,
			required: true,
			unique: true
		},
		mergeField: String,
		closed: {
			type: Boolean,
			default: false
		},
		expires: Date,
		allowUpdate: Boolean,
		intro: String,
		thanksTitle: String,
		thanksText: String
	} )
};

module.exports.schema.virtual( 'active' ).get( function () {
	return !this.closed && (!this.expires || moment.utc(this.expires).isAfter());
});

module.exports.model = mongoose.model( module.exports.name, module.exports.schema );
