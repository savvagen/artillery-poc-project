# Ensure Shutdown Plugin
This plugin gathers the statistics from artillery `stats` report, checks the thresholds and conditions, and uses `shutdown` flag to stop artillery test if the condition or threshold is failed.

## Shutdown flag

This flag gives you an ability to stop the test once single or fiew `thresholds` and `conditions` will fail.

``` 
NOTE! shutdown flag supports only "strict" enusre conditions
```

Example:

```yaml
config:
  target: "https://www.artillery.io"
  plugins:
    ensure-shutdown: {}
  phases:
    - duration: 10
      arrivalRate: 1
  ensure:
    thresholds:
      - http.response_time.max: 5000
        strict: true
        shutdown: false
      - vusers.failed: 20
        strict: true
        shutdown: true
    conditions:
      - expression: vusers.created <= 20
        strict: true
        shutdown: true

```

In this example `ensure` plugin will check each 10 sec. (every time when metrics are thrown to the console) if some of these conditions are passed.
If shutdown flag is specified, then artilley stops the test with `exit code: 1`

### List of supported metrics:

| Metric Name                            |             
|----------------------------------------|
| http.response_time.min                 |
| http.response_time.max                 |
| http.response_time.count               |
| http.response_time.p50                 |
| http.response_time.median              |
| http.response_time.p75                 |
| http.response_time.p90                 |
| http.response_time.p95                 |
| http.response_time.p99                 |
| http.response_time.p999                |
| http.codes.<status_code>               |
| http.requests                          |
| http.request_rate                      |
| vusers.created                         |
| vusers.completed                       |
| vusers.skipped                         |
| vusers.failed                          |
| vusers.created_by_name.<scenario_name> |
| vusers.session_length.count            |
| vusers.session_length.min              |
| vusers.session_length.max              |
| vusers.session_length.p50              |
| vusers.session_length.median           |
| vusers.session_length.p75              |
| vusers.session_length.p90              |
| vusers.session_length.p95              |
| vusers.session_length.p99              |
                                   
