const Clause = require('./Clause')
const {makePath} = require('./util')

// https://dev.mysql.com/doc/refman/5.7/en/json-search-functions.html
module.exports = class JsonContains extends Clause {

    constructor(value, path='$', conjunction='AND'){
        super()
        this.value = value
        this.path = path
        this.conjunction = ['and', 'or'].includes(conjunction.toLowerCase()) ? conjunction : 'AND'
    }

    toSqlString(db, key){

        let value = this.value

        if( !Array.isArray(value) )
            value = [value]

        return value.map(val=>{

            let path = makePath(this.path, db)

            if( val == undefined )
                return `JSON_CONTAINS_PATH(${key}, 'all', '${path}')`

            val = db.escape(val)
            
            if( val.match(/^'/) )
                val = val.replace(/^'/, `"`).replace(/'$/, `"`)
            
            return `JSON_CONTAINS(${key}, '${val}', '${path}' )`

        }).join(' '+this.conjunction+' ')   
    }
}