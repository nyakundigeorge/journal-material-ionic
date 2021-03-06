angular.module('journal-material.service-localdb', [])

.service("journal-material.service-localdb.DBService",
[
	function(){
		var self = this;
		
		this.Pouch = null;
		this.dbname = null;

		this.connect = function(dbname){
			self.dbname = dbname;
			var promise = new Promise(function(resolve, reject){
					self.Pouch = new PouchDB(self.dbname);
					if(self.Pouch) 
						resolve();
					else
						reject();	
				})
				;

			return promise
				.then(self.recreateViews)
				;
		}

		/** SORTING PROTOCOL **/
		this.sort_criteria = {
			DATE_DESC: "DATE_DESC",
			DATE_ASC: "DATE_ASC",
			NAME_DESC: "NAME_DESC",
			NAME_ASC: "NAME_ASC",
			LAST_JOURNAL_DESC: "LAST_JOURNAL_DESC",
			UPDATED_DESC: "UPDATED_DESC"
		}

		this.prepareSortParams = function(_id, sort_criteria, sort_criteria_params){
			var params_lambda = sort_criteria_params[sort_criteria];
			if(params_lambda)
				return params_lambda(_id)
			else 
				throw "sort criterium " + sort_criteria + " not supported";
		}
		/** END: SORTING PROTOCOL **/

		this.save = function(object /* :IDocument */) {
			object.updated_at = new Date();
			return self.Pouch.put(object)
				.then(function(docsum){
					object._rev = docsum.rev;
					return object;
				})
				;
		};

		this.saveView = function(object) {
			object.updated_at = new Date();
			return self.Pouch.put(object)
				.then(function(docsum){
					object._rev = docsum.rev;
					return docsum;
				})
		};

		this.all = function(options = {}){
			return self.Pouch.allDocs(options)
			.then(function(res){
				if(res.rows.length > 0)
					return res.rows.map(function(it){
						return it.doc;
					});
				else
					return [];
			})
			;
		}

		this.get = function(_id){
			return self.Pouch.get(_id).catch(function(error){console.log(error);});
		};

		this.queryView = function(view, options){
			options = options || {};
			return self.Pouch.query(view, options)
				.catch(function(error){ 
					if(error.status == 404) { // undefined view
						throw new self.DBException("undefined view " + view);
					}
					else
						return error;
				})
				;
		}

		this.mapRedios = function(mapredios){
			return self.Pouch.query(mapredios);
		}

		this.destroy = function(object /* :IDocument */){
			return self.Pouch.remove(object._id, object._rev);
		}

		this.destroyIds = function(id, rev){
			return self.Pouch.remove(id, rev);
		}

		this.attach = function(document /* :IDocument */, file_object /* :IFile */) {
			return self.save(document).then(function(){
				return self.Pouch.putAttachment(
						document._id, file_object.uuid, document._rev,
						file_object.data, file_object.content_type
					).then(function(doc){
						document._rev = doc.rev;
					})			
				})
		}

		this.detach = function(id, rev, file_object /* :IFile */){
			return self.Pouch.removeAttachment(id, file_object.name, rev);
		}

		this.clear = function(){
			return self.Pouch.allDocs()
				.then(function(docs){
					if(docs)
						return Promise.mapSeries(docs.rows, function(doc){
								if (doc.id.match(/^_design\/.*$/))
									return
								else {
									return self.destroyIds(doc.id, doc.value.rev)
									;
								}
							})
							.all()
							;
				})
				.then(function(){
					return self.Pouch.compact();
				})
				.then(self.recreateViews)
				;
		}

		this.sync = function(url, remote_options) {

			remote_options = remote_options || {};

			var remote = new PouchDB(url, remote_options);

			var action = null
			if(remote_options.replicate_to) {
				action = this.Pouch.replicate.to;
			} else if(remote_options.replicate_from) {
				action = this.Pouch.replicate.from;
			} else {
				action = this.Pouch.sync;
			}

			return new Promise(function(resolve, reject) {

				action(remote, {retry: true})
				.on("complete", function(){
					resolve();
				})
				.on("error", function(error){
					reject(error);
				})
				;

			})
			;
		}

		/** VIEW MANAGEMENT **/
		var registered_views = {};
		function SaveView(view){
			registered_views[view._id] = view;
		}
		function RegisteredViews(){
			return registered_views;
		}

		this.checkDBViews = function(views){
			for(var i in views)
				SaveView(views[i]);
			self.recreateViews();
		}

		this.recreateViews = function(){
			var views = RegisteredViews();
			var promises = []
			for(var i in views) {
				var promise = self.save(views[i])
					.catch(function(error){
						if(error.name != "conflict")
						{
							console.log(error);
						} // else: conflict means view already exists
					})
					;
				promises.push(promise);
			}
			return Promise.all(promises);
		}
		/** END: VIEW MANAGEMENT **/

		/** @section Exceptions **/
		this.DBException = function(message){
			this.message = message;
		}
		this.DBException.prototype = new Error();
		/** @endsection Exceptions **/
	}
])

.service("journal-material.service-localdb.FakerService",
[
	function(){
		var self = this;

		/** @section Public **/
		this.withFaker = function(callback){
			return function(){
				return EnsureFakerLoaded()
					.then(function(){
						return callback();
					})
			}
		}
		/** @endsection Public **/

		/** @section Private **/
		var faker_loaded = null;
		var EnsureFakerLoaded = function(){
			if (!faker_loaded)
				faker_loaded = new Promise(function(resolve, reject){
					if(faker)
						resolve();
					else
						requirejs(["lib/faker.min"], 
							function(faker){
								resolve()
							},
							function(error){
								reject(error);
							}
						)
				})
				;

			return faker_loaded;
		};
		/** @endsection Private **/
	}
])

.run([
	"journal-material.service-localdb.DBService",
	function(DBService){
		var userdb_name = "username" + "_localdb"; //TODO: get user name
		return DBService.connect(userdb_name);
	}
])

;