/*
    Для работы виджета необходимо:
    1. Настроить https iframe vk приложение
    2. Включить приложение

    Необходимы следующие скрипты
    1. scrollPane
    2. isotope
    3. imagesLoaded
*/

var vkFriendsWidget = {
    Views: {},
    Models: {},
    Collections: {},
    Helpers: {},
    Init: {}
};

$(function () {
    var delay = (function(){
        var timer = 0;
        return function(callback, ms){
            clearTimeout (timer);
            timer = setTimeout(callback, ms);
        };
    })();

    var friendsWidgetIsotope = false;
    var qsRegex = '';
    var scrollPaneAPI;

    /************************************************************************************
     MODELS
     *************************************************************************************/

    vkFriendsWidget.Models.Friends = Backbone.Model.extend({
        defaults: {
            offset: 0,
            perPage: 50,
            count: false
        }
    });

    vkFriendsWidget.Models.Friend = Backbone.Model.extend({
        defaults: {
            id: 0,
            sex: '',
            first_name: "",
            last_name: "",
            nickname: "",
            online: 0,
            photo_100: "",
            photo_200_orig: "",
            photo_50: "",
            active: false
        }
    });

    /************************************************************************************
     COLLECTIONS
     *************************************************************************************/

    vkFriendsWidget.Collections.Friends = Backbone.Collection.extend({
        model: vkFriendsWidget.Models.Friend
    });

    /************************************************************************************
     VIEWS
     *************************************************************************************/

    vkFriendsWidget.Views.Friend = Backbone.View.extend({
        events: {
            'click a': 'activate'
        },

        template: _.template(
            '<li class="hint small" title="<%= first_name %> <%= last_name %>" data-search="<%= first_name %> <%= last_name %> <%= nickname %>">'+
            '<a href="#">'+
            '<img src="<%= photo_50 %>">'+
            '<p class="name"><%= first_name %> <%= last_name %></p>'+
            '</a></li>'),

        initialize: function () {
            this.model.on("remove", this.remove, this);
            this.model.on("change:active", this.activeChange, this);
        },

        render: function () {
            this.setElement( this.template(this.model.toJSON()) );
            return this;
        },

        remove: function () {
            this.$el.remove();
        },

        activate: function(e) {
            e.preventDefault();

            if ( this.model.get('active') ) {
                this.model.set('active', false);
            } else {
                this.model.set('active', true);
            }
        },

        activeChange: function() {
            if ( this.model.get('active') ) {
                this.$el.addClass('active');
            } else {
                this.$el.removeClass('active');
            }
        }
    });

    vkFriendsWidget.Views.Friends = Backbone.View.extend({
        tagName: "ul",

        initialize: function(options) {
            this.collection = new vkFriendsWidget.Collections.Friends();
            this.collection.on("add", this.addFriend, this);
            this.model = new vkFriendsWidget.Models.Friends();

            qsRegex = '';
        },

        getFriends: function( offset ) {
            if ( typeof offset == 'undefined' ) offset = 0;
            if ( this.model.get('count') != false && this.model.get("offset") >= this.model.get('count') ) return;

            var request = {
                // Доступные значения:
                // nickname, domain, sex, bdate, city, country, timezone,
                // photo_50, photo_100, photo_200_orig, has_mobile, contacts, education, online,
                // relation, last_seen, status, can_write_private_message, can_see_all_posts, can_post, universities
                fields: 'nickname, sex, photo_50, photo_100, photo_200_orig, photo_max_orig',
                count: this.model.get("perPage"),
                offset: offset
            };

            VK.api('friends.get', request, function (data) {
                if ( data.error ) {
                    console.error( data.error.error_msg );
                    return;
                }
                this.model.set("count", data.response.count);
                this.model.set("offset", offset);

                if ( this.model.get('count') != 0 ) {
                    for (var i = 0; i < data.response.items.length; i++) {
                        this.collection.add( new vkFriendsWidget.Models.Friend(data.response.items[i]) );
                    }

                    if ( this.model.get("offset") <= this.model.get('count') ) {
                        this.getFriends(this.model.get("offset") + this.model.get("perPage"));

                        scrollPaneAPI.reinitialise();
                    }

                    this.$el.imagesLoaded( function() {
                        friendsWidgetIsotope.isotope( 'reloadItems' )
                            .isotope({ sortBy: 'original-order' });
                    }.bind(this));
                }
            }.bind(this));
        },

        addFriend: function( model ) {
            var newFriend = new vkFriendsWidget.Views.Friend({ model: model }).render();

            this.$el.append( newFriend.el );
            friendsWidgetIsotope.isotope( 'appended', newFriend.el );
        }
    });

    vkFriendsWidget.Views.Search = Backbone.View.extend({
        events: {
            "keyup input.search": "searchFriends"
        },

        searchFriends: function(e) {
            delay(function(){
                var field = $(e.currentTarget);

                qsRegex = new RegExp( field.val(), 'gi' );
                friendsWidgetIsotope.isotope();

                setTimeout(function(){
                    scrollPaneAPI.reinitialise();
                }, 600)
            }, 300 );
        }
    });

    /************************************************************************************
     INIT
     *************************************************************************************/
    vkFriendsWidget.Init = Backbone.View.extend({
        template: templateHelper( "vkFriendsWidgetTemplate" ),

        initialize: function(options) {
            if ( typeof VK == 'undefined' ) {
                console.error('Не подключен VK Javascript SDK');
                console.log('https://vk.com/dev/Javascript_SDK');
                return;
            }

            VK.init(function() {
                this.render();
            }.bind(this), function() {
                console.log('error');
            }, '5.29');
        },

        render: function() {
            this.$el.html( this.template() );

            this.searchView = new vkFriendsWidget.Views.Search({
                el: $('form', this.$el)
            });

            this.friendsView = new vkFriendsWidget.Views.Friends();

            $('.friends', this.$el).html(this.friendsView.$el);
            friendsWidgetIsotope = $('.friends ul', this.$el).isotope({
                itemSelector: 'li',
                masonry: {
                    columnWidth: 320,
                    gutter: 5
                },
                filter: function() {
                    return qsRegex ? $(this).attr('data-search').match( qsRegex ) : true;
                }
            });

            scrollPaneAPI = $('.scroll-pane', this.$el).jScrollPane({
                showArrows: false,
                verticalDragMinHeight: 25,
                verticalDragMaxHeight: 25,
                autoReinitialise: true
            });

            scrollPaneAPI = scrollPaneAPI.data('jsp');

            this.renderFriends();
        },

        renderFriends: function() {
            this.friendsView.getFriends();
        }
    });

});