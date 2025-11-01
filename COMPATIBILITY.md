# SSI Compatibility Roadmap

This document tracks progress towards full compatibility with Apache and Nginx SSI implementations.

## Overview

This plugin aims to support all standard SSI directives and features found in:
- [Nginx SSI Module](https://nginx.org/en/docs/http/ngx_http_ssi_module.html)
- [Apache mod_include](https://httpd.apache.org/docs/current/mod/mod_include.html)
- [Apache SSI Tutorial](https://httpd.apache.org/docs/current/howto/ssi.html)

## Compatibility Status

### ✅ Implemented

#### SSI Commands

| Command | Nginx | Apache | Status | Notes |
|---------|-------|--------|--------|-------|
| `<!--#include virtual="..." -->` | ✅ | ✅ | ✅ | Supports absolute (from root) and relative paths |
| `<!--#include file="..." -->` | ✅ | ✅ | ⏳ | Not yet implemented - currently only `virtual` is supported |

#### Core Features

| Feature | Nginx | Apache | Status | Notes |
|---------|-------|--------|--------|-------|
| Recursive includes | ✅ | ✅ | ✅ | Configurable depth limit (default: 10) |
| Circular dependency detection | ✅ | ✅ | ✅ | Automatic detection with clear error messages |
| Path resolution | ✅ | ✅ | ✅ | Absolute (from root) and relative paths |
| Error handling | ✅ | ✅ | ✅ | Clear error messages for missing files, circular deps, etc. |
| File type filtering | ✅ | ✅ | ✅ | Configurable via `includeFileTypes` option |
| HMR support | N/A | N/A | ✅ | Automatic reloading when included files change |

### ⏳ In Progress / Planned

#### SSI Commands

| Command | Nginx | Apache | Status | Priority | Notes |
|---------|-------|--------|--------|----------|-------|
| `<!--#echo var="..." -->` | ✅ | ✅ | ⏳ | High | Output variable values |
| `<!--#set var="..." value="..." -->` | ✅ | ✅ | ⏳ | High | Set variable values |
| `<!--#if expr="..." -->` | ✅ | ✅ | ⏳ | High | Conditional includes |
| `<!--#elif expr="..." -->` | ✅ | ✅ | ⏳ | High | Else-if conditionals |
| `<!--#else -->` | ✅ | ✅ | ⏳ | High | Else conditionals |
| `<!--#endif -->` | ✅ | ✅ | ⏳ | High | End conditional block |
| `<!--#include file="..." -->` | ✅ | ✅ | ⏳ | Medium | File-based includes (vs virtual) |
| `<!--#include stub="..." -->` | ✅ | ✅ | ⏳ | Medium | Fallback content for failed includes |
| `<!--#include wait="yes" -->` | ✅ | ✅ | ⏳ | Low | Sequential processing flag |
| `<!--#include set="..." -->` | ✅ | ✅ | ⏳ | Low | Store include result in variable |
| `<!--#config errmsg="..." -->` | ✅ | ✅ | ⏳ | Medium | Custom error messages |
| `<!--#config timefmt="..." -->` | ✅ | ✅ | ⏳ | Medium | Time format configuration |
| `<!--#config sizefmt="..." -->` | ❌ | ✅ | ⏳ | Low | File size format (Apache only) |
| `<!--#flastmod file="..." -->` | ❌ | ✅ | ⏳ | Low | File last modification date |
| `<!--#fsize file="..." -->` | ❌ | ✅ | ⏳ | Low | File size |
| `<!--#exec cmd="..." -->` | ✅ | ✅ | ❌ | N/A | **Security risk - intentionally not implemented** |
| `<!--#exec cgi="..." -->` | ❌ | ✅ | ❌ | N/A | **Security risk - intentionally not implemented** |
| `<!--#block name="..." -->` | ✅ | ✅ | ⏳ | Medium | Define reusable blocks |
| `<!--#endblock -->` | ✅ | ✅ | ⏳ | Medium | End block definition |
| `<!--#printenv -->` | ❌ | ✅ | ⏳ | Low | Print all environment variables |

### ❌ Not Planned

| Feature | Reason |
|---------|--------|
| `<!--#exec cmd="..." -->` | Security risk - allows arbitrary command execution |
| `<!--#exec cgi="..." -->` | Security risk - allows CGI execution |

## Detailed Feature Comparison

### Nginx SSI Module Features

#### Directives

| Directive | Default | Status | Notes |
|-----------|---------|--------|-------|
| `ssi` | `off` | ✅ | Enabled by plugin |
| `ssi_last_modified` | `off` | ⏳ | Preserve Last-Modified header |
| `ssi_min_file_chunk` | `1k` | ❌ | Not applicable (Vite context) |
| `ssi_silent_errors` | `off` | ⏳ | Suppress error output |
| `ssi_types` | `text/html` | ✅ | Configurable via `includeFileTypes` |
| `ssi_value_length` | `256` | ⏳ | Max parameter value length |

#### SSI Commands

All Nginx SSI commands are listed in the compatibility table above.

#### Embedded Variables

| Variable | Description | Status |
|----------|-------------|--------|
| `$date_local` | Current time in local timezone | ⏳ |
| `$date_gmt` | Current time in GMT | ⏳ |

### Apache mod_include Features

#### Directives

| Directive | Status | Notes |
|-----------|--------|-------|
| `Options +Includes` | ✅ | Implicitly enabled |
| `Options +IncludesNOEXEC` | ✅ | Exec disabled by default |
| `XBitHack` | ❌ | Not applicable |
| `AddType` / `AddOutputFilter` | ⏳ | Handled via `includeFileTypes` config |

#### SSI Commands

All Apache SSI commands are listed in the compatibility table above.

#### Environment Variables

Apache supports various built-in environment variables:

| Variable | Description | Status |
|----------|-------------|--------|
| `DATE_GMT` | Current GMT date/time | ⏳ |
| `DATE_LOCAL` | Current local date/time | ⏳ |
| `DOCUMENT_NAME` | Current filename | ⏳ |
| `DOCUMENT_URI` | Current file path | ⏳ |
| `LAST_MODIFIED` | Last modification date of current file | ⏳ |
| `QUERY_STRING_UNESCAPED` | Unescaped query string | ⏳ |
| Various HTTP headers | `HTTP_USER_AGENT`, etc. | ⏳ |

## Implementation Notes

### Current Implementation

- ✅ Basic SSI include processing
- ✅ Recursive includes with depth limiting
- ✅ Circular dependency detection
- ✅ Error handling and reporting
- ✅ HMR support for included files
- ✅ Configurable file type processing
- ✅ Absolute and relative path resolution

### Known Limitations

1. **Only `virtual` includes supported**: The `file` parameter for includes is not yet implemented
2. **No variable support**: Variables (`echo`, `set`) are not yet implemented
3. **No conditionals**: `if`, `elif`, `else`, `endif` are not yet implemented
4. **No configuration directives**: `config` directive is not yet implemented
5. **No file metadata**: `flastmod`, `fsize` are not yet implemented
6. **No blocks**: `block`, `endblock` are not yet implemented
7. **No execution**: `exec` is intentionally not implemented for security reasons

### Planned Implementation Order

1. **Phase 1: Core SSI Commands** (High Priority)
   - `echo` - Variable output
   - `set` - Variable assignment
   - `if/elif/else/endif` - Conditional logic

2. **Phase 2: Enhanced Includes** (Medium Priority)
   - `file` parameter for includes
   - `stub` parameter for fallback content
   - `block/endblock` for reusable content blocks

3. **Phase 3: Configuration** (Medium Priority)
   - `config errmsg` - Custom error messages
   - `config timefmt` - Time format configuration
   - `config sizefmt` - File size format (Apache)

4. **Phase 4: File Metadata** (Low Priority)
   - `flastmod` - File last modification date
   - `fsize` - File size
   - Environment variables (`DATE_GMT`, `DATE_LOCAL`, etc.)

5. **Phase 5: Advanced Features** (Low Priority)
   - `include wait` - Sequential processing
   - `include set` - Store include result in variable
   - `printenv` - Print environment variables

## Contributing

Contributions towards compatibility are welcome! When implementing new features:

1. Check both Nginx and Apache documentation for differences in behavior
2. Add comprehensive tests for the new feature
3. Update this compatibility document
4. Consider edge cases and error handling

## References

- [Nginx SSI Module Documentation](https://nginx.org/en/docs/http/ngx_http_ssi_module.html)
- [Apache mod_include Documentation](https://httpd.apache.org/docs/current/mod/mod_include.html)
- [Apache SSI Tutorial](https://httpd.apache.org/docs/current/howto/ssi.html)

