Comments
============

Allows for realtime comments to be added to any view/section. Comments are grouped under a "group" and "ID" for that group (`gid`)

## Setup

```js
import Comments from 'bui/components/comments'

// these are the defaults, change if neeed
Comments.API_ROOT = '/api'
Comments.User = window.User
Comments.extensions = [] // for things like "mentions"
Comments.avatarTag = 'avatar-element'
Comments.nameTag = 'name-tag-element' // defaults to avatar if not set
```

#### Mentions
If you want support for mentions, you need to do additional setup

```js
import {html} from 'lit-html'
import mentionPlugin, {MentionElement}  from 'bui/components/comments/mentions'

// create the custom "mention" element
customElements.define('mention-element', class extends MentionElement {

	static items(query){
        // example
		return Users.toJSON()
		.filter(user=>user.name.toLowerCase().startsWith(query.toLowerCase()))
		.slice(0, 5)
		.map(user=>{return {label: user.name, val: user.id}})
	}

    render(){return html`@${this.uname}`}
})

// then create and add the mention plugin as an extension
Comments.extensions = [mentionPlugin('mention-element')]
```

## Use

Here's an example for adding comments to a book record:

```html
<b-comments group="book" gid="4805"></b-comments>
```

#### Group
`group` should be the name of the table for which this comment parent model is in.

#### GID
`gid` (group ID) should be the unique ID of the parent model

#### Meta
Comments have additional "metadata" stored in the `meta` field. By default `location.pathname` is stored under `path` and any mentions under `mentions`

You can choose to add additional metadata by setting `.meta` (either an object or a function that returns an object is expected)

```html
<b-comments group="book" gid="4805" .meta=${{title: 'Only Yesterday'}}></b-comments>
```

#### Model
You can give the comment a model and the `GID` and `Meta` will be set using that model. Note: `group` must still be set

- `gid` = model.id
- `meta` = model.commentMeta

```html
<b-comments group="book" .model=${this.model}></b-comments>
```

## Styling

### Parts
- `write-comment`
- `comment`

Example:

```css
/* make comments look more like post it notes */
b-comment::part(comment) {
	background: yellow;
	padding: .5em;
	border-radius: 5px;
}
```

## Events

### Will Take Action

- `new-comment`
- `edit`
- `delete`
- `resolve`
- `react`

> See `helpers/lit-element/will-take-action` for usability

## Server Model
```js
const Comments = require(bui`components/comments/server/model`)

// Optionally add a PushMsg class that will be intialized when a new comment is added
// Comments.PushMsg = PushMsg

// or subclass with own logic
// class MyComments extends Comments(){
// 	sendPushMsg(){ /* implement own logic */}
// }

// add class to your API init
new API(app, [
	Comments
], {root: '/api'})
```

## Notes
- no permisions right now
    - anyone can edit an existing comment
    - anyone an delete
    - anyone can comment