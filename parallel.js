var async = require('./lib/async.js');

// Public API
module.exports = parallel;

/**
 * Runs iterator over provided array elements in parallel
 *
 * @param {array|object} list - array or object (named list) to iterate over
 * @param {function} iterator - iterator to run
 * @param {function} callback - invoked when all elements processed
 */
function parallel(list, iterator, callback)
{
  var isNamedList = !Array.isArray(list)
    , state =
    {
      index    : 0,
      namedList: isNamedList ? Object.keys(list) : null,
      jobs     : {},
      results  : isNamedList ? {} : []
    }
    ;

  while (state.index < (state['namedList'] || list).length)
  {
    iterateJob(list, iterator, state, callback);
    state.index++;
  }
}

/**
 * Iterates over each job object
 *
 * @param {array|object} list - array or object (named list) to iterate over
 * @param {function} iterator - iterator to run
 * @param {object} state - current job status
 * @param {function} callback - invoked when all elements processed
 */
function iterateJob(list, iterator, state, callback)
{
  // store current index
  var key = state['namedList'] ? state['namedList'][state.index] : state.index;

  state.jobs[key] = runJob(iterator, key, list[key], function(error, output)
  {
    // don't repeat yourself
    // skip secondary callbacks
    if (!(key in state.jobs))
    {
      return;
    }

    // clean up jobs
    delete state.jobs[key];

    if (error)
    {
      // don't process rest of the results
      // stop still active jobs
      // and reset the list
      abortJobs(state);
      // return salvaged results
      callback(error, state.results);
      return;
    }

    state.results[key] = output;

    // looks like it's the last one
    if (Object.keys(state.jobs).length === 0)
    {
      callback(null, state.results);
      return;
    }
  });
}

/**
 * Runs iterator over provided job element
 *
 * @param   {function} iterator - iterator to invoke
 * @param   {string|number} key - key/index of the element in the list of jobs
 * @param   {mixed} item - job description
 * @param   {function} callback - invoked after iterator is done with the job
 * @returns {function|mixed} - job abort function or something else
 */
function runJob(iterator, key, item, callback)
{
  var abort;

  // allow shortcut if iterator expects only two arguments
  if (iterator.length == 2)
  {
    abort = iterator(item, async(callback));
  }
  // otherwise go with full three arguments
  else
  {
    abort = iterator(item, key, async(callback));
  }

  return abort;
}

/**
 * Aborts leftover active jobs
 *
 * @param {object} state - current state object
 */
function abortJobs(state)
{
  Object.keys(state.jobs).forEach(clean.bind(state));

  // reset leftover jobs
  state.jobs = {};
}

/**
 * Cleans up leftover job by invoking abort function for the provided job id
 *
 * @this  state
 * @param {string|number} key - job id to abort
 */
function clean(key)
{
  if (typeof this.jobs[key] == 'function')
  {
    this.jobs[key]();
  }
}
