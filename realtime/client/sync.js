import io from 'socket.io-client'
import SyncPath from './sync-path'

let MainSync

export default function sync(path, object){

    if( typeof path == 'function' )
        return enableSync(path, object)

    MainSync = MainSync || new Sync()
    return MainSync.add(path, object)
}

export class Sync extends Map {

    constructor(path='/sync'){
        super()

        this.socket = io(path, {
            transports: ['websocket']
        });

        this.socket.on('connect', ()=>{ this.reconnect() })
        this.socket.on('sync', payload=>{ this.onSync(payload) })
    }

    onSync(payload){
        let syncPath = this.get(payload.path)

        if( payload.socketIDs.includes(this.socket.id) )
            return

        if( !syncPath ) return console.warn('cannot sync: ', payload)
        syncPath.onSync(payload.data)
    }

    add(path, object){
        let syncPath = MainSync.get(path, true)
        syncPath.add(object)
        return syncPath 
    }

    _changePath(syncPath, path){
        
        let wasConnected = syncPath.isConnected
        syncPath.disconnect()

        this.delete(syncPath.path)
        syncPath.path = path
        this.set(path, syncPath)

        if( wasConnected )
            syncPath.connect()
    }

    reconnect(){
        
        // FIXME: change to one call that opens all
        if( this.hasConnected )
            this.forEach(syncPath=>{syncPath.reconnect()})
        
        this.hasConnected = true
    }

    get(path, create=false){
		if( !super.get(path) && create === true ){
			this.set(path, new SyncPath(this, path))
		}

        return super.get(path)
    }

}

export function enableSync(Class, {
    pathKey='url'
}={}){

    Object.defineProperty(Class.prototype, 'realtimeSync', {
        get: function realtimeSync() {
            return this.__realtimeSync = this.__realtimeSync || sync(this[pathKey], this)
        }
    });

    let syncData = Class.prototype.map ? syncBackboneCollection : syncBackboneModel

    Class.prototype.onSync = function(data){
        syncData.call(this, data)
    }
}


// NOTE: do we really need different sync methods for coll/vs model?
// maybe can refactor to one?
export function syncBackboneCollection(data, {
    addUpdates=true,
    triggerDestroy=false
}={}){

    let {action, attrs, url} = data
    let thisUrl = typeof this.url == 'function' ? this.url() : this.url
    let model = this.get(attrs.id)
    
    action = action.toLowerCase()

    // sync url is different, so use it to try and find the correct child model
    if( url && url != thisUrl ){
        
        // `/api/book/1/elements/2` => `elements.2`
        let path = url.replace(thisUrl+'/', '').replace(/\//g, '.')

        // remove trailing ID `model.1` => `model`
        if( data.action == 'add' )
            path = path.replace(/\.\d+$/,'')

        model = this.get(path)

        if( !model && addUpdates ){
            data.action = 'add'
            path = path.replace(/\.\d+$/,'')
            model = this.get(path) || this
        }
    }

    if( !model )
        return addUpdates ? console.warn('Sync: unsure how to handle, ', data) : false

    if( ['update', 'patch'].includes(action) )
        model.set(attrs)

    if( ['insert', 'add'].includes(action) )
        model.add(attrs)
    
    if( ['destroy', 'delete'].includes(action) ){

        if( model.collection )
            model.collection.remove(model)

        if( triggerDestroy )
            model.trigger('destroy', model, model.collection, {})
    }
}

export function syncBackboneModel(data, {addMissingUpdates=true}={}){
    
    let model = this
    let {action, attrs, syncData, url} = data
    
    // sync url is different, so use it to try and find the correct child model
    if( url && url != this.url() ){
        
        // `/api/book/1/elements/2` => `elements.2`
        let path = url.replace(this.url()+'/', '').replace(/\//g, '.')

        // remove trailing ID `model.1` => `model`
        if( data.action == 'add' )
            path = path.replace(/\.\d+$/,'')

        model = this.get(path)

        if( !model && addMissingUpdates ){
            data.action = 'add'
            path = path.replace(/\.\d+$/,'')
            model = this.get(path)
        }
    }

    if( !model )
        return console.warn('Sync: unsure how to handle, ', data)

    let didSync = false

    if( action == 'add' && attrs ){
        let m = model.add(attrs)
        didSync = true
    }
    
    if( action == 'update' ){
        didSync = true
        model.set(syncData||attrs)
    }

    if( action == 'destroy' && model.collection ){
        didSync = true
        // can't call `model.destroy` as that would send a request to the server
        model.collection.remove(model)
        model.trigger('destroy', model, model.collection, {})
    }

    // let views know when sync changes happen
    if( didSync )
        model.trigger('realtime-sync', data)

    return didSync
}
