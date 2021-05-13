require('../util/promise.series')

const defaultConfig = {
    idAttribute: 'id'
}

module.exports = class Model {

    // DEPRECATED
    static setDB(_db){ Model.db = _db }
    
    get db(){ return this.__db || this.constructor.db }
    set db(db){ this.__db = db }

// methods to override in subclass

    findWhere(where, opts){
        // add or manipulate the where clause
    }

    findSql(where, {select="*"}={}){

        if( !this.config.table ) throw Error('missing config.table')
        
        return /*sql*/`SELECT ${select} 
                        FROM ${this.config.table} ${this.config.tableAlias||''}
                        ${where}
                        ${this.findOrderBy()}
                        ${this.findLimit}`
    }

    get findLimit(){
        if( this.req && this.req.query.perPage )
            return `LIMIT ${this.req.query.pageAt},${this.req.query.perPage}`
            
        return this.config.limit ? `LIMIT ${this.config.limit}` : ''
    }
    
    findOrderBy(){
        let orderBy = this.config.orderBy
        return  orderBy ? `ORDER BY ${orderBy}` : ''
    }

    findParseRow(row, index, resultCount){
        this.decodeFields(row)
        return row
    }

    validateUpdate(attrs){
        this.encodeFields(attrs)
        return attrs
    }

    async beforeAdd(attrs){ /* noop */ }
    afterAdd(attrs){ /* noop */ }

    async beforeUpdate(attrs, where){ /* noop */ }
    afterUpdate(attrs){ /* noop */ }

    async beforeDestroy(where){ /* noop */ }
    afterDestroy(){ /* noop */ }

// =================================================
    
    constructor(attrs, req, opts={}){

        if( !this.db )
            console.warn('Model.db has not been set yet')
            
        this.req = req
        this.attrs = attrs || {}
        this.opts = opts

        for(let key in attrs){
            this[key] = attrs[key]
        }

        this.decodeFields(attrs)
    }

    get config(){ return {} }

    get id(){ return this.__id || this.attrs[this.idAttribute] }
    set id(id){ this.__id = id }
    
    get idAttribute(){ return this.config.idAttribute || defaultConfig.idAttribute }
    get tableAlias(){ return this.config.tableAlias || this.config.table }

    get isInvalid(){
        return this.attrs === undefined
    }

    toJSON(){
        return Object.assign({}, this.attrs||{})
    }

    get filters(){
        try {
            let filters = this.req.query.filters

            if( filters && typeof filters == 'string')
                return JSON.parse(filters)
            else if( filters )
                return filters
            else
                return {}
        }catch(err){
            console.log('Malformed filters:', this.req.query.filters);
            return {}
        }
    }

    get sorts(){    
        try{
            let sorts = this.req.query.sorts ? JSON.parse(this.req.query.sorts) : {}
            return new Map(Object.entries(sorts));
        }catch(err){
            console.log('Malformed sorts:', this.req.query.sorts);
            return new Map()
        }
    }

    // NOTE: does't appear to be used anywhere....
    // but seems useful...not sure reason for fn?
    orderBy(fn){
        let sorts = this.sorts
        let orderBy = []

        sorts.forEach((sortOpts,key)=>{
        // for(let key in sorts ){
            
            // let sortOpts = sorts[key]
            let desc = sortOpts.desc ? 'DESC' : 'ASC'

            if( !fn || fn(key, sortOpts) === undefined )
                orderBy.push(`${this.db.escapeId(key)} ${desc}`)
        // }
        })

        return orderBy.length > 0 ? 'ORDER BY '+orderBy.join(', ') : ''
    }

// =================================================
//  Deafult CRUD method implementations

    encodeFields(attrs){
        this.encodeJsonFields(attrs)
        this.encodeCsvFields(attrs)
    }
    
    decodeFields(attrs){
        this.decodeJsonFields(attrs)
        this.decodeCsvFields(attrs)
    }

    encodeCsvFields(attrs){
        if( this.config.csvFields && Array.isArray(this.config.csvFields) ){
            this.config.csvFields.forEach(fieldName=>{
                if( attrs[fieldName] != undefined )
                    attrs[fieldName] = attrs[fieldName] ? attrs[fieldName].join(',') : null
            })
        }
    }

    decodeCsvFields(attrs){
        if( this.config.csvFields && Array.isArray(this.config.csvFields) ){
            this.config.csvFields.forEach(fieldName=>{
                
                if( attrs[fieldName] == undefined ) return

                if( attrs[fieldName] && typeof attrs[fieldName] == 'string' )
                    attrs[fieldName] = attrs[fieldName].split(',')
                else if( !attrs[fieldName] )
                    attrs[fieldName] = []
            })
        }
    }

    encodeJsonFields(attrs){
        if( this.config.jsonFields && Array.isArray(this.config.jsonFields) ){
            this.config.jsonFields.forEach(fieldName=>{
                if( attrs[fieldName] != undefined )
                    attrs[fieldName] = attrs[fieldName] ? JSON.stringify(attrs[fieldName]) : null
            })
        }
    }
    
    decodeJsonFields(attrs){
        if( this.config.jsonFields && Array.isArray(this.config.jsonFields) ){
            this.config.jsonFields.forEach(fieldName=>{
                
                if( attrs[fieldName] == undefined ) return

                try{
                    if( attrs[fieldName] && typeof attrs[fieldName] == 'string' )
                        attrs[fieldName] = JSON.parse(attrs[fieldName])
                    else
                        attrs[fieldName] = attrs[fieldName] || []
                }catch(err){
                    attrs[fieldName] = {}
                }
            })
        }
    }

    async find(where=null, opts={}){

        let id = null;

        // make sure "id" is prefixed with correct table name/alias
        if( where && where[this.idAttribute] ){
            id = where[this.idAttribute]
            delete where[this.idAttribute]
            where[this.tableAlias+'.'+this.idAttribute] = id
        
        }else if( where && where[this.tableAlias+'.'+this.idAttribute] ){
            id = where[this.tableAlias+'.'+this.idAttribute]

        // if no special WHERE given, default to querying for this model
        }else if( !where && this.id ) {
            where = {}
            id = this.id
            where[this.tableAlias+'.'+this.idAttribute] = this.id
        }

        where = where || {}

        // let subclassed model apply more to where clause
        await this.findWhere(where, opts)

        let [clause, clauseValues] = new this.db.clauses.Group(where).toSqlString(this.db)
        where = clause ? `WHERE ${clause}` : ''

        let sql = this.findSql(where, opts)
        if( typeof sql != 'string' ) return sql

        let resp = await this.db.query(sql, clauseValues)

        // parse each row (for decoding JSON strings, etc)
        await Promise.series(resp, (row,i)=>{
            return this.findParseRow(row, i, resp.length)
        })

        // might need to activate this if too  many conflicts
        let convertToObject = true//this.config.resultsAsObject == true
        let ClassObj = Object.getPrototypeOf(this).constructor
        
        if( id && id == this.id ){
            this.attrs = resp[0]
            return this
        }else if( id ){
            if( convertToObject )
                return new ClassObj(resp[0], this.req)
            else
                return resp[0]
        }

        // convert each row to a class object
        if( convertToObject )
            resp = resp.map(attrs=>new ClassObj(attrs, this.req))

        return resp;
    }

    async add(attrs={}){

        if( !this.config.table ) throw Error('missing config.table')

        this.encodeFields(attrs)
        await this.beforeAdd(attrs)

        if( !attrs || Object.keys(attrs).length == 0 )
            throw Error('no data to add')

        let result = await this.db.q(/*sql*/`INSERT INTO ${this.config.table} 
                                        SET ? ${this.db.updateOnDuplicate(attrs)}`, attrs)
        
        if( !result.insertId && !result.affectedRows )
            throw Error('failed to insert')

        this.id = result.insertId || this.id

        this.afterAdd&&this.afterAdd(attrs)

        let resp = await this.find()

        if( this.config.sync && this.req && this.syncData )
            this.syncData({
                action:'add',
                attrs:resp,
                syncData:attrs,
                method: this.req.method,
                url: this.apiPath
            })

        return resp
    }

    async update(attrs={}){

        // let subclass remove or modify attributes to be updated
        attrs = await this.validateUpdate(attrs)
        let where = {[this.idAttribute]:this.id}
        await this.beforeUpdate(attrs, where)

        if( !this.config.table ) throw Error('missing config.table')

        if( !this.id || !attrs || Object.keys(attrs).length == 0 )
            return false;

        let result = await this.db.q(/*sql*/`UPDATE ${this.config.table} SET ? WHERE ?`, [
            attrs, 
            where
        ])

        if( result.affectedRows > 0 ){
            
            this.decodeFields(attrs)

            this.afterUpdate(attrs)

            if( this.id )
                this.attrs = Object.assign(this.attrs||{}, attrs)

            if( this.config.sync && this.req && this.syncData )
                this.syncData({
                    action: 'update',
                    attrs: this.toJSON(),
                    syncData: attrs,
                    method: this.req.method,
                    url: this.apiPath
                })

            return attrs
        }
        
        return false
    }

    async destroy(){

        if( !this.config.table ) throw Error('missing config.table')
        if( !this.id ) throw Error('missing id')

        await this.find()
        
        if( this.isInvalid ) throw Error('Cannot delete: model not found')

        let where = {[this.idAttribute]:this.id}
        await this.beforeDestroy(where)

        let [clause, clauseValues] = new this.db.clauses.Group(where).toSqlString(this.db)
        
        let result = await this.db.q(/*sql*/`DELETE FROM ${this.config.table} WHERE ${clause}`, clauseValues)

        await this.afterDestroy(result)

        if( this.config.sync && this.req && this.syncData && result )
            this.syncData({
                action: 'destroy',
                attrs: this.toJSON(),
                method: this.req.method,
                url: this.apiPath
            })

        return String(result.affectedRows)
    }
}
