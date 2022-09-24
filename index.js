const builder = require('botbuilder');
const restify = require('restify');
const githubClient = require('./github-client');


const connector = new builder.ChatConnector();

const bot = new builder.UniversalBot(connector)
    .set('storage',new builder.MemoryBotStorage());

const dialog=new builder.IntentDialog();

dialog.matches(/^search/i,[
    function(session,args,next){
        if(session.message.text.toLowerCase()==='search'){
            builder.Prompts.text(session,'Who are youlooking for?');
        } else{
            var query=session.message.text.substring(7);
            next({response:query});
        }
    },
    function(session,result,next){
        var query=result.response;
        if(!query){
            session.endDialog('Request cancelled');
        } else{
            githubClient.executeSearch(query,function(profiles){
                var totalCount=profiles.total_count;
                if(totalCount===0){
                    session.endDialog('Sorry, no results found.');
                } else if(totalCount>10){
                    session.endDialog('Provide more restrictive querry');
                } else{
                    session.dialogData.property=null;
                    var usernames=profiles.items.map(function(item){item.login});
                    builder.Prompts.choice(session,'Select User');
                }
            })
        }
    },
    function(session,result,next){
        var username=result.response.entity;
        githubClient.loadProfile(username,function(profile){
            var card=new builder.ThumbnailCard();
            card.title(profile.login);
            card.images([builder.CardImage.create(session,profile.avatar_url)]);
            if(profile.name) card.subtitle(profile.name);

            var text='';
            if(profile.company) text+=profile.company+'\n';
            if(profile.email) text+=profile.email+'\n';
            if(profile.bio) text+=profile.bio+'\n';
            card.text(text);

            card.tap(new builder.CardAction.openUrl(session,profile.html_url));

            var message=new builder.Message(session).attachments([card]);
            session.send(message);
        })
    }
]);

bot.dialog('/',dialog);

const server = restify.createServer();
server.post('/api/message', connector.listen());
server.listen(3978);