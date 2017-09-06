define(["puiCleaner", "text!../hbs/puiDropdown.hbs", 'underscore', 'handlebars', 'jquery'], 
	function(puiCleaner, puiSelectTemplate, _, HBS, $){
	
	/*
	 *  Compile a Handlebars template for the dropdown.
	 */
	var puiSelectTemplate = HBS.compile(puiSelectTemplate);
	
	/*
	 *  Use the above template to create a select with
	 *  all paths.
	 */
	var populateDropdownWithSubpaths = function(dropdownSelector, selectId, groupMap){
		$(dropdownSelector).html(puiSelectTemplate({
				selectId : selectId,
				groups : groupMap
			}));
	};
	
	/*
	 * Recursively retrieve all paths.
	 * 
	 * We use localStorage to cache the paths client side so 
	 * page refreshes don't take forever.
	 */
	var loadOntology = function(baseUrl, callback){
		var basePath = "/NHANES/rest/resourceService/path";
		var tree = [];

		/*
		 * We cache the tree as a courtesy to users. It takes
		 * way too long to retrieve each time they refresh the
		 * page. 
		 * 
		 * If it's already cached, we just pass it back.
		 */
		if(localStorage.getItem("tree") !== null){
			tree = JSON.parse(window.localStorage.getItem("tree"));
			callback(tree);
		} else {
			/*
			 * Map the current path and all sub-paths 
			 * into a pathGrouping object.
			 */
			var buildGrouping = function(pathInfo, callback){
				var pathGrouping = {
					groupName : pathInfo.displayName,
					pui : pathInfo.pui,
					values: []
				};
				var deferred = $.Deferred();

				/*
				 * Make a call to the path endpoint to get sub-paths,
				 * recursively building a path grouping for each. 
				 * 
				 * Resolve our local deferred when this has been completed.
				 */
				var descendIntoTree = function(){
					$.get(basePath + puiCleaner(pathInfo.pui), function(childData, status, jqXHR){
						var childDeferreds = [];
						_.each(childData, function(childPathInfo){
							var childDeferred = $.Deferred();
							/*
							 * Ah... recursion, notice here we are passing childDeferred's resolve
							 * method as our callback for buildGrouping
							 */
							pathGrouping.values.push(buildGrouping(childPathInfo, childDeferred.resolve));
							childDeferreds.push(childDeferred);
						});
						$.when.apply($, childDeferreds).then(deferred.resolve);					
					});
				}
				
				/*
				 * The i2b2/tranSmart Resource Interface passes us some
				 * display cues. If the value is CA or FA, then there
				 * should be sub-paths. If it is an LA, our path is a leaf.
				 */
				switch(pathInfo.attributes.visualattributes){
				case "CA ":
					descendIntoTree();
					break;
				case "FA ":
					descendIntoTree();
					break;
				case "LA ":
					pathGrouping = {
						pui : pathInfo.pui,
						label : pathInfo.displayName
					};
					deferred.resolve();
					break;
				default:
					/*
					 * If we ever see one we don't know how to handle, 
					 * just give up gracefully.
					 */
					console.log("Unsupported visual attribute value. |" 
							+ pathInfo.attributes.visualattributes + "|");
					deferred.resolve();
					break;
				}
				/*
				 * When the local deferred object has been resolved, pass
				 * our local tree to the callback function. Remember recursion.
				 */
				$.when(deferred).then(function(){
					callback(tree);
				});
				return pathGrouping;
			}
			
			$.get(basePath + baseUrl,
					function(data, status, jqXHR){
				var topLevelDeferreds = [];
				_.each(data, function(pathInfo){
					var childDeferred = $.Deferred();
					tree.push(buildGrouping(pathInfo, childDeferred.resolve));
					topLevelDeferreds.push(childDeferred);
				});
				$.when.apply($, topLevelDeferreds).then(function(tree){
					window.localStorage.setItem("tree", JSON.stringify(tree));
					callback(tree);
				});
			});
		}
	};
	
	return {
		populateDropdownWithSubpaths : populateDropdownWithSubpaths,
		loadOntology : loadOntology
	}
});