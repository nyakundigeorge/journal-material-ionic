angular.module('journal-material.Quests.controllers', [])

.controller('journal-material.Quests.controllers.MainCtrl', function($scope){

})

.controller('journal-material.Quests.controllers.ContextController', function($scope){
	$scope.currentContext ="app.quests";
	$scope.contextMenu = [
		{go: "app.quests.focus", name: "Focus"},
		{go: "app.quests.listings({status:'BLOCKED'})", name: "Waiting"},
		{go: "app.quests.listings({status:'OPEN'})", name: "Open"},
		{go: "app.quests.listings({status:'SCHEDULED'})", name: "Scheduled"}
	];
})

.controller('journal-material.Quests.controllers.AllCtrl', [
	"$scope",
	"journal-material.Quests.services.QuestService",
	"$q",
	"journal-material.services.SortCriteriaService",
	function($scope, QuestService, $q, SortCriteriaService){
		$scope.sorting = SortCriteriaService.Enum.UPDATED_DESC;
		QuestService.getSummarizedQuestLog($scope.sorting).then(function(response){
			$scope.quest_log = response;
		});
	}
])

.controller('journal-material.Quests.controllers.FocusCtrl', [
	"$scope",
	"journal-material.Quests.services.QuestService",
	function($scope, QuestService) {
		$scope.focus = []

		QuestService.getByStatus("FOCUS").then(function(quests){
			$scope.focus = quests;
		})
	}
])

.controller('journal-material.Quests.controllers.ListingCtrl', 
	[
		"$scope", "$stateParams",
		"journal-material.Quests.services.QuestService", 
		function($scope, $stateParams, QuestService){
			var status = $stateParams.status;
			$scope.title = QuestService.TranslateStatus(status);

			$scope.quests = [];

			QuestService.getByStatus(status).then(function(quests){
				$scope.quests = quests;
			});
		}
	]
)

.controller('journal-material.Quests.controllers.EditCtrl', [
	"$scope",
	"$rootScope",
	"$stateParams",
	"$ionicHistory",
	"$ionicPopup",
	"$state",
	"journal-material.Quests.services.QuestFactory",
	"journal-material.Quests.services.QuestService",
	"ionicDatePicker",
	function($scope, $rootScope, $stateParams, $ionicHistory, $ionicPopup, $state, QuestFactory, QuestService, ionicDatePicker){
		$scope.id = $stateParams.id;
		$scope.must_confirm = true;
		if($scope.id) {
			$scope.action = "Edit Quest";
			QuestService.get($scope.id).then(function(quest){
				$scope.quest = quest;
			})
		} else {
			$scope.action = "New Quest";
			$scope.quest = QuestFactory._new();
		}

		$scope.contexts = [
			{id: 1, name: "TFG"},
			{id: 2, name: "GFS"},
			{id: 3, name: "IOS"}
		]

		$scope.statuses = [
			{id: "OPEN", name: "Open"},
			{id: "FOCUS", name: "Focus"},
			{id: "BLOCKED", name: "Waiting"}
		]

		var deadline_obj = {
			callback: function(val) {
				$scope.quest.deadline = val;
			}
		}

		/** METHODS **/
		$scope.selectDeadline = function(){
			ionicDatePicker.openDatePicker(deadline_obj);
		}

		$scope.save = function(form){
			if(form.$valid){
				QuestService.save($scope.quest)
					.then(function(){
						$scope.must_confirm = false;
						$ionicHistory.clearCache().then(function(){
							return $ionicHistory.goBack();	
						})
					})
			}
		}

		$scope.cancel = function(){
			$ionicHistory.goBack();
		}
		/** END: METHODS **/

		/** EVENTS **/

		// prevent going out of state without saving
		$scope.$on("$stateChangeStart", 
			function(event, toState, fromState, toParams, fromParams){
				var $scope = event.currentScope;
				if($scope.must_confirm){
					event.preventDefault();
					$ionicPopup.confirm({
						title: "Data will be lost!"
					}).then(function(ok){
						if(ok) {
							$scope.must_confirm = false;
							$state.go(toState, toParams);
						}
					})
				}
			}
		)
		/** END: EVENTS **/
	}
])

.controller('journal-material.Quests.controllers.DetailCtrl',
[
	"$scope",
	"questData",
	"$rootScope",
	"$state",
	"$stateParams",
	"$ionicHistory",
	"$ionicPopup",
	"journal-material.Quests.services.QuestService",
	"journal-material.Quests.services.EnumService",
	function($scope, questData, $rootScope, $state, $stateParams, $ionicHistory, 
		$ionicPopup, QuestService, EnumService){
		$scope.id = $stateParams.id;
		$scope.quest = questData;
		$scope.title = "Quest";
		if(!$scope.id) {
			$ionicHistory.goBack();
		}

		/** PROVIDERS **/
		$scope.state_transitions = QuestService;
		/** END:PROVIDERS **/

		/** METHODS **/
		$scope.addTask = function() {
			$ionicPopup.prompt({
				title: "New task",
				template: "Write a new task",
				inputType: "text",
				inputPlaceholder: "task"
			}).then(function(res){
				var task = QuestService.newTask(res);
				$scope.quest.tasks.push(task);
			})
		}

		$scope.addEntry = function(){
			$state.go('app.journal.edit', {quest_id: $scope.quest._id})
		}

		$scope.setFocus = function(quest){
			QuestService.isFocusFull().then(function(is_full){
				if(is_full){
					$ionicPopup.confirm({
						title: "Focus crowded",
						subTitle: "There are so many tasks in focus, the journal will put the lastest updated to OPEN state."
					}).then(function(ok_to_proceed){
						if(ok_to_proceed) {
							QuestService.removeLatestFromFocus().then(function(){
								QuestService.setFocus(quest).then(function(){
									return $ionicHistory.clearCache();
								})
							})
						}
					})
				} else 
					return QuestService.setFocus(quest).then(function(){
						return $ionicHistory.clearCache();
					});
			})
		}

		$scope.setOpen = function(quest){
			QuestService.setOpen(quest).then(function(){return $ionicHistory.clearCache(); })
		}

		$scope.setBlock = function(quest){
			$ionicPopup.prompt({
				title: "Block reason",
				template: "Why is this task blocked?",
				inputType: "text",
				inputPlaceholder: "reason"
			}).then(function(blocked_reason){
				if(blocked_reason) {
					QuestService.setBlocked(quest, blocked_reason).then(function(){
						return $ionicHistory.clearCache();
					})
				}
			})
		}

		$scope.setDone = function(quest){

		}

		$scope.setFail = function(quest){

		}

		$scope.setScheduled = function(quest){

		}
		/** END: METHODS **/
	}
])

.controller('journal-material.Quests.controllers.TodoListCtrl',
	function($scope, $stateParams){

	}
)

;