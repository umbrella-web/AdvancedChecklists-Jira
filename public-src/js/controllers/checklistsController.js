'use strict';

angularApplication.controller('ChecklistsController', ["$scope", "$sce", function($scope, $sce) {
	var checklistsCtrl = this;
	var appData = window.checklistsData;

	/**
	 * Initialized JWT token 
	 * @param location
	 * @returns {{}}
	 */
	var parseLocation = function(location) {
		var pairs = location.substring(1).split("&");
		var obj = {};
		var pair;
		var i;

		for ( i in pairs ) {
			if ( pairs[i] === "" ) continue;

			pair = pairs[i].split("=");
			obj[ decodeURIComponent( pair[0] ) ] = decodeURIComponent( pair[1] );
		}

		return obj;
	};
	var getEndpointWithToken = function( endpoint ) {
		return endpoint + '?jwt=' + jwtToken;
	};
	var jwtToken = parseLocation(window.location.search)['jwt'];

	/**
	 * Initialize error occurred flag
	 * @type {boolean}
	 */
	checklistsCtrl.errorOccurred = false;

	/**
	 * Function parsed plain text and return html with replaced entries
	 * @param text
	 * @returns {string}
	 */
	var parseItemText = function( text ) {
		// split text to words by space
		var words = text.split(' ');
		
		// loop all words and try find entries
		for ( var i in words ) {
				// replace urls to html <a></a> tag
				words[i] = words[i].replace(/(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#/%=~_|$?!:,.]*\)|[A-Z0-9+&@#/%=~_|$])/igm, function(url, isHttpDetected ){
					return '<a target="_blank" href="'+url+'">'+url+'</a>';
				});
		}
		
		return words.join(' ');
	};
	
	/**
	 * Initialized checklists model
	 */
	checklistsCtrl.checklists = appData.checklists;
	
	for ( var i in checklistsCtrl.checklists ) {
		checklistsCtrl.checklists[i].editName = checklistsCtrl.checklists[i].name;
		
		for ( var j in checklistsCtrl.checklists[i].items ) {
			checklistsCtrl.checklists[i].items[j].editText = checklistsCtrl.checklists[i].items[j].text;
			checklistsCtrl.checklists[i].items[j].parsedText = $sce.trustAsHtml( parseItemText( checklistsCtrl.checklists[i].items[j].text ) );
		}
	}

	/**
	 * Initialized total count open/close items
	 */
	var calcTotal = function(){
		setTimeout(function(){
			checklistsCtrl.total = {};
			checklistsCtrl.total.open = 0;
			checklistsCtrl.total.all = 0;
			for ( var i1 in checklistsCtrl.checklists ) {
				for ( var j1 in checklistsCtrl.checklists[i1].items ) {
					if (checklistsCtrl.checklists[i1].items[j1].checked ) {
						checklistsCtrl.total.open++;
					}
					checklistsCtrl.total.all++;
				}
			}

			$scope.$apply();
		}, 50);
	};
	calcTotal();

	/**
	 * Initialized new checklist model
	 * @type {{name: string}}
	 */
	checklistsCtrl.newChecklist = {
		'name': '',
		'editMode': false
	};

	$scope.checklistsSortableOptions = {
		handle: '.checklist-wapper div.header-checklist',
		axis: 'y',
		stop: function(e) {
			var ids = [];
			for (var i in checklistsCtrl.checklists ) {
				ids.push( checklistsCtrl.checklists[i].id );
			}
			
			jQuery.post( getEndpointWithToken( appData.endpoints.order_checklist ), {
				'orders': ids 
			}, function( response ){
				if (response.status != true) {
					checklistsCtrl.errorOccurred = true;
				}
			}).fail(function() {
				checklistsCtrl.errorOccurred = true;
				$scope.$apply();
			});
		}
	};

	$scope.itemsSortableOptions = {
		items: "li:not(.add-new-item-link)",
		connectWith: "ul.checklist",
		axis: 'y',
		stop: function(e) {
			var checklistsSorts = {};
			for (var i in checklistsCtrl.checklists ) {
				var itemIds = [];
				for (var j in checklistsCtrl.checklists[i].items) {
					itemIds.push( checklistsCtrl.checklists[i].items[j].id );
				}
				checklistsSorts[ checklistsCtrl.checklists[i].id ] = itemIds;
			}
			
			//console.log(checklistsSorts);
			jQuery.post( getEndpointWithToken( appData.endpoints.order_items ), {
				'checklists_sort': checklistsSorts
			}, function( response ){
				if (response.status != true) {
					checklistsCtrl.errorOccurred = true;
				}
			}).fail(function() {
				checklistsCtrl.errorOccurred = true;
				$scope.$apply();
			});
		}
	};

	/**
	 * Create new checklist
	 */
	checklistsCtrl.addNewChecklist = function() {
		if ( ! checklistsCtrl.newChecklist.name ) {
			return;
		}
		
		jQuery.post( getEndpointWithToken( appData.endpoints.create_checklist ), {
			'name': checklistsCtrl.newChecklist.name
		}, function( response ) {
			if (response.status != true) {
				checklistsCtrl.errorOccurred = true;
				return;
			}

			checklistsCtrl.checklists.push({
				'id': response.checklist_id,
				'name': checklistsCtrl.newChecklist.name,
				'editName': checklistsCtrl.newChecklist.name,
				'items': [],
				'completedPercents': "0%",
				'newItemEditMode': true
			});

			console.log('Created new checklist "'+checklistsCtrl.newChecklist.name+'" with ID: ' + response.checklist_id);

			checklistsCtrl.newChecklist.name = '';
			checklistsCtrl.newChecklist.editMode = false;

			$scope.$apply();
		}).fail(function() {
			checklistsCtrl.errorOccurred = true;
			$scope.$apply();
		});
	};

	/**
	 * Update checklist name
	 * @param checklist
	 */
	checklistsCtrl.updateChecklist = function( checklist ) {
		if ( checklist.name == checklist.editName ) {
			checklist.editMode = ! checklist.editMode;
			return;
		}
		
		checklist.name = checklist.editName;
		jQuery.post( getEndpointWithToken( appData.endpoints.update_checklist ), {
			'id': checklist.id,
			'name': checklist.name
		}, function( response ) {
			if (response.status != true) {
				checklistsCtrl.errorOccurred = true;
				return;
			}

			console.log('New checklist name: ' + checklist.name);
			checklist.editMode = ! checklist.editMode;

			$scope.$apply();
		}).fail(function() {
			checklistsCtrl.errorOccurred = true;
			$scope.$apply();
		});
	};

	/**
	 * Remove checklist
	 * @param checklist
	 */
	checklistsCtrl.removeChecklist = function( checklist ) {
		for ( var i in checklistsCtrl.checklists ) {
			if (checklistsCtrl.checklists[i].id == checklist.id) {
				jQuery.post( getEndpointWithToken( appData.endpoints.remove_checklist ), {
					'id': checklist.id
				}, function( response ) {
					if (response.status != true) {
						checklistsCtrl.errorOccurred = true;
					}

					console.log('Removed checklist "'+checklist.name+'" with ID: ' + checklist.id);

					// re-calc total of items
					calcTotal();
				}).fail(function() {
					checklistsCtrl.errorOccurred = true;
					$scope.$apply();
				});
				checklistsCtrl.checklists.splice(i,1);
			}
		}
	};

	/**
	 * Add new item to checklist
	 * @param checklist
	 */
	checklistsCtrl.addNewItem = function( checklist ) {
		if ( ! checklist.newItemText ) {
			return;
		}
		
		var selectedColor = checklist.newItemColor;
		if ( ! selectedColor ) {
			selectedColor = '#000000';
		}
		
		jQuery.post( getEndpointWithToken( appData.endpoints.create_item ), {
			'checklist_id': checklist.id,
			'item_text': checklist.newItemText,
			'color': selectedColor
		}, function( response ) {
			if (response.status != true) {
				checklistsCtrl.errorOccurred = true;
				return;
			}

			checklist.items.push({
				'id': response.item_id,
				checked: false,
				'text': checklist.newItemText,
				'editText': checklist.newItemText,
				'parsedText': $sce.trustAsHtml( parseItemText( checklist.newItemText ) ),
				'color': selectedColor
			});
			checklist.completedPercents = getCompletedPercents( checklist.items );

			// re-calc total of items
			calcTotal();

			console.log('Created new item "'+checklist.newItemText+'" with ID: ' + response.item_id);

			// reset selected color
			checklist.newItemColor = '#000000';
			
			checklist.newItemText = '';

			$scope.$apply();
		}).fail(function() {
			checklistsCtrl.errorOccurred = true;
			$scope.$apply();
		});
	};

	/**
	 * update item
	 * @param item
	 */
	checklistsCtrl.updateItem = function( checklist, item ) {
		if ( item.editText == item.text && item.editColor == item.color ) {
			item.editMode = ! item.editMode;
			return;
		}

		item.text = item.editText;
		item.color = item.editColor;
		item.parsedText = $sce.trustAsHtml( parseItemText( item.editText ) );
		
		jQuery.post( getEndpointWithToken( appData.endpoints.update_item ), {
			'checklist_id': checklist.id,
			'item_id': item.id,
			'item_text': item.text,
			'color': item.color
		}, function( response ) {
			if (response.status != true) {
				checklistsCtrl.errorOccurred = true;
				return;
			}

			console.log('Updated item "'+item.text+'" with ID: ' + item.id);
			item.editMode = ! item.editMode;

			$scope.$apply();
		}).fail(function() {
			checklistsCtrl.errorOccurred = true;
			$scope.$apply();
		});
	};

	/**
	 * Remove item from checklist
	 * @param checklist
	 * @param item
	 */
	checklistsCtrl.removeItem = function( checklist, item ) {
		for ( var i in checklist.items ) {
			if ( checklist.items[i].id == item.id ) {
				jQuery.post( getEndpointWithToken( appData.endpoints.remove_item ), {
					'checklist_id': checklist.id,
					'item_id': item.id
				}, function( response ) {
					if (response.status != true) {
						checklistsCtrl.errorOccurred = true;
					}

					console.log('Removed item "'+item.text+'" with ID: ' + item.id + ' in checklist "'+checklist.name+'" with ID: ' + checklist.id);
				}).fail(function() {
					checklistsCtrl.errorOccurred = true;
					$scope.$apply();
				});
				checklist.items.splice(i,1);
				checklist.completedPercents = getCompletedPercents( checklist.items );

				// re-calc total of items
				calcTotal();
			}
		}
	};

	/**
	 * Complete/Un-complete item in checklist
	 * @param el
	 */
	checklistsCtrl.completeItem = function(checklist, item) {
		item.checked = !item.checked;
		checklist.completedPercents = getCompletedPercents( checklist.items );
		jQuery.post( getEndpointWithToken( appData.endpoints.complete_item ), {
			'checklist_id': checklist.id,
			'item_id': item.id
		}, function( response ) {
			if (response.status != true) {
				checklistsCtrl.errorOccurred = true;
			}

			if ( response.checked ) {
				console.log('Completed item "'+item.text+'" with ID: ' + item.id);
			} else {
				console.log('Uncompleted item "'+item.text+'" with ID: ' + item.id);
			}

			// re-calc total of items
			calcTotal();
			
		}).fail(function() {
			checklistsCtrl.errorOccurred = true;
			$scope.$apply();
		});
	};

	/**
	 * Disable all edit/new modes (on items and checklists)
	 */
	var disableAllEditModes = function(){
		checklistsCtrl.newChecklist.editMode = false;
		for ( var i in checklistsCtrl.checklists ) {
			checklistsCtrl.checklists[i].editMode = false;
			checklistsCtrl.checklists[i].newItemEditMode = false;
			for ( var j in checklistsCtrl.checklists[i].items ) {
				checklistsCtrl.checklists[i].items[j].editMode = false;
			}
		}
	};
	
	/**
	 * Toggle new checklist form
	 */
	checklistsCtrl.toggleNewChecklistForm = function() {
		if ( ! checklistsCtrl.newChecklist.editMode ) {
			disableAllEditModes();
		}
		checklistsCtrl.newChecklist.editMode = ! checklistsCtrl.newChecklist.editMode;
	};

	/**
	 * Toggle checklist in/out edit mode
	 * @param checklist
	 */
	checklistsCtrl.toggleChecklistEdit = function( checklist ) {
		if ( ! checklist.editMode ) {
			disableAllEditModes();
		}
		checklist.editMode = ! checklist.editMode;
		
		if ( checklist.editMode && ! checklist.editName ) {
			checklist.editName = checklist.name;
		} 
	};
	
	checklistsCtrl.toggleNeItemEditMode = function( checklist ) {
		if ( ! checklist.newItemEditMode ) {
			disableAllEditModes();
		}
		checklist.newItemEditMode = ! checklist.newItemEditMode;
	};

	/**
	 * Toggle item edit mode
	 * @param item
	 */
	checklistsCtrl.toggleItemEditMode = function( item, $event ) {
		if ( typeof $event != 'undefined' && angular.element($event.target).is('a') ) {
			return;
		}
		if ( ! item.editMode ) {
			disableAllEditModes();
		}
		item.editMode = ! item.editMode;
		
		if ( item.editMode && ! item.editText ) {
			item.editText = item.text;
		}
		if ( item.editMode && ! item.editColor ) {
			item.editColor = item.color
		}
	};

	/**
	 * Function return completed percents items in checklist
	 * @param items
	 * @returns {string}
	 */
	var getCompletedPercents = function(items) {
		var checked = 0;
		for (var i in items) {
			if (items[i].checked) {
				checked++;
			}
		}
		
		if ( ! items.length ) {
			return '0%';
		}
		return Math.round( (checked * 100) / items.length  ) + '%';
	};

	/**
	 * Loop all checklists and init completed percents
	 */
	for (var i in checklistsCtrl.checklists) {
		checklistsCtrl.checklists[i].completedPercents = getCompletedPercents( checklistsCtrl.checklists[i].items );
	}
	
}]);