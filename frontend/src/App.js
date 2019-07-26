import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link, Switch, Redirect } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Alert from 'react-bootstrap/Alert';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import ListGroup from 'react-bootstrap/ListGroup';
import Media from 'react-bootstrap/Media';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import './App.css';

function getRequestHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Token ${localStorage.getItem('jwtToken')}`
  };
}

class CommentForm extends Component {
  constructor(props) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.textarea = React.createRef();
    this.showReplyForm = this.showReplyForm.bind(this);
    this.hideReplyForm = this.hideReplyForm.bind(this);
    this.state = {
      handleSubmit: this.props.handleSubmit || this.handleSubmit,
      handleChange: this.props.handleChange || this.handleChange
    };
  }

  handleSubmit(event) {
    fetch('/comments/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({
        comment: {
          post_id: this.props.postId,
          parent_comment_id: this.props.parent_comment_id,
          text: this.state.text
        }})
    })
      .then(response => response.json())
      .then(data => {
        this.textarea.current.value = "";
        this.props.updatePost(data);
        this.props.updateParent(data);
        if (!this.props.topComment) {
          this.props.hideForm();
        }
      });

    event.preventDefault();
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  showReplyForm(event) {
    this.setState({
      formClass: 'show'
    });
    event.preventDefault();
  }

  hideReplyForm() {
    this.setState({
      formClass: 'hide'
    });
  }

  render() {
    if (!authenticated()) {
      return '';
    }
    let replyLink = '';
    let cancelButton = '';
    if (!this.props.topComment) {
      replyLink = (
        <Button
          variant="link"
          size="sm"
          onClick={this.showReplyForm}
        >
          reply
        </Button>
      );
      cancelButton = (
        <Button
          variant="secondary"
          onClick={this.props.hideForm}
        >
          Cancel
        </Button>
      );
    }
    return (
      <div>
        <Form onSubmit={this.state.handleSubmit}>
          <Form.Group as={Col} md="5" controlId="text">
            <Form.Label>Speaking as {localStorage.getItem('username')}</Form.Label>
            <Form.Control
              onChange={this.state.handleChange}
              as="textarea"
              name="text"
              placeholder="Comment"
              rows="5"
              ref={this.textarea}
              value={this.props.initialValue}
            />
          </Form.Group>
          <Form.Group as={Col}>
            <ButtonToolbar>
              <Button type="submit">Save</Button>
              {cancelButton}
            </ButtonToolbar>
          </Form.Group>
        </Form>
      </div>
    );
  }
}

class Comment extends Component {
  constructor(props) {
    super(props);
    this.state = {
      comment: this.props.comment,
      replyFormClass: 'hide',
      toolBarClass: 'show',
      editFormClass: 'hide',
      commentBodyClass: 'show',
      text: this.props.comment.text
    };
    if (this.props.comment.author === localStorage.getItem('username')) {
      this.state.isAuthorClass = 'show';
    } else {
      this.state.isAuthorClass = 'hide';
    }
    this.updateChildComments = this.updateChildComments.bind(this);
    this.vote = this.vote.bind(this);
    this.showCommentForm = this.showCommentForm.bind(this);
    this.hideCommentForm = this.hideCommentForm.bind(this);
    this.clickEdit = this.clickEdit.bind(this);
    this.hideEditForm = this.hideEditForm.bind(this);
    this.submitEdit = this.submitEdit.bind(this);
    this.getEditText = this.getEditText.bind(this);
  }

  updateChildComments(newComment) {
    this.setState((prevState, props) => {
      return {
        ...prevState,
        comment: {
          ...prevState.comment,
          child_comments: [newComment].concat(prevState.comment.child_comments)
        }
      };
    });
  }

  vote(value) {
    const makeVote = (() => {
      this.setState((prevState) => {
        let newScore = prevState.comment.score;
        if (prevState.comment.upvoted) {
          newScore -= 1;
        } else if (prevState.comment.downvoted) {
          newScore += 1;
        }
        return {
          ...prevState,
          comment: {
            ...prevState.comment,
            upvoted: value === 1,
            downvoted: value === -1,
            score: newScore + value
          }
        };
      });
      fetch('/comment/vote/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${localStorage.getItem('jwtToken')}`
        },
        body: JSON.stringify({
          vote: {
            comment_id: this.state.comment.id,
            value: value
          }
        })
      })
        .then(response => response.json())
        .then(data => {
          this.setState({
            comment: data.comment
          });
        });
    });
    return makeVote;
  }

  showCommentForm() {
    this.setState({
      replyFormClass: 'show'
    });
  }

  hideCommentForm() {
    this.setState({
      replyFormClass: 'hide'
    });
  }

  clickEdit() {
    this.setState({
      editFormClass: 'show',
      commentBodyClass: 'hide',
      toolBarClass: 'hide'
    });
  }

  hideEditForm() {
    this.setState({
      editFormClass: 'hide',
      commentBodyClass: 'show',
      toolBarClass: 'show'
    });
  }

  getEditText(event) {
    if (event.target.name === 'text') {
      this.setState({
        text: event.target.value
      });
    }
  }

  submitEdit(event) {
    fetch(`/comment/${this.state.comment.id}/`, {
      method: 'PATCH',
      headers: getRequestHeaders(),
      body: JSON.stringify({
        text: this.state.text
      })
    })
      .then(response => response.json())
      .then(data => {
        this.setState((state) => ({
          comment: {
            ...state.comment,
            text: data.text,
            last_modified: data.last_modified
          }
        }));
        this.hideEditForm();
      });
    event.preventDefault();
  }

  render() {
    const { author, score, text, last_modified, upvoted, downvoted } = this.state.comment;
    const { post, updatePost } = this.props;
    let upvoteButton = (
      <Button
        variant="outline-primary"
        size="sm"
        className="upvote"
        onClick={this.vote(1)}
      >
        ▲
      </Button>
    );
    if (authenticated() && upvoted) {
      upvoteButton = (
        <Button
          variant="primary"
          size="sm"
          className="upvote"
          onClick={this.vote(0)}
        >
          ▲
        </Button>
      );
    }
    let downvoteButton = (
      <Button
        variant="outline-danger"
        size="sm"
        onClick={this.vote(-1)}
        className="downvote"
      >
        ▼
      </Button>
    );
    if (authenticated() && downvoted) {
      downvoteButton = (
        <Button
          variant="danger"
          size="sm"
          onClick={this.vote(0)}
          className="downvote"
        >
          ▼
        </Button>
      );
    }
    return (
      <ListGroup>
        <ListGroup.Item>
          <Media>
            <div>
              {upvoteButton}
              <br />
              {downvoteButton}
            </div>
            <Media.Body>
              <div className={this.state.editFormClass}>
                <CommentForm
                  postId={post.id}
                  initialValue={this.state.text}
                  hideForm={this.hideEditForm}
                  handleSubmit={this.submitEdit}
                  handleChange={this.getEditText}
                />
              </div>
              <div className={`comment-body ${this.state.commentBodyClass}`}>
                <p>
                  <small>
                    <Link to={`/users/${author}`} className="sm-margin-right">
                      {author}
                    </Link>
                    <strong className="sm-margin-right">
                      {score} point{score === 1 ? '' : 's'}
                    </strong>
                    <span className="text-muted">
                      {last_modified}
                    </span>
                  </small>
                </p>
                <p>{text}</p>
                <div className={this.state.toolBarClass}>
                  <ButtonToolbar>
                    <Button variant="link" size="sm">permalink</Button>
                    <div className={this.state.isAuthorClass}>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={this.clickEdit}
                      >
                        edit
                      </Button>
                      <Button variant="link" size="sm">delete</Button>
                    </div>
                    {authenticated() && <Button
                      variant="link"
                      size="sm"
                      onClick={this.showCommentForm}
                    >
                      reply
                     </Button>}
                  </ButtonToolbar>
                </div>
                <div className={this.state.replyFormClass}>
                  <CommentForm
                    postId={post.id}
                    updatePost={updatePost}
                    updateParent={this.updateChildComments}
                    parent_comment_id={this.state.comment.id}
                    hideForm={this.hideCommentForm}
                  />
                </div>
              </div>
              {this.state.comment.child_comments.map((c) => {
                return (
                  <Comment
                    key={c.id}
                    comment={c}
                    post={post}
                    updatePost={updatePost}
                  />
                );
              })}
            </Media.Body>
          </Media>
        </ListGroup.Item>
      </ListGroup>
    );
  }
}

function getHeader(post) {
  let header, postText;
  if (post.is_link) {
    header = (
      <h1>
        <a href={post.link} target="_blank" rel="noopener noreferrer">
          {post.title}
        </a>
      </h1>
    );
    postText = '';
  } else {
    header = (
      <h1>
        <Link to={`/r/${post.subreddit}/${post.id}/${post.slug}/comments`}>
          {post.title}
        </Link>
      </h1>
    );
    postText = <p>{post.text}</p>;
  }
  return [header, postText];
}

class CommentsPage extends Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.updateComments = this.updateComments.bind(this);
    this.updatePost = this.updatePost.bind(this);
    this.addNewComment = this.addNewComment.bind(this);
  }

  updateComments() {
    const {name, id, slug} = this.props.match.params;
    let headers = {};
    if (authenticated()) {
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      };
    }
    fetch(`/r/${name}/${id}/${slug}/comments/`, { headers })
      .then(response => {
        if (response.status !== 200) {
          console.warn('uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({post: data.post}));
  }

  updatePost() {
    this.setState((state) => {
      return {
        post: {
          ...state.post,
          numComments: state.post.numComments + 1
        }
      };
    });
  }

  addNewComment(newComment) {
    this.setState((state) => {
      return {
        post: {
          ...state.post,
          comments: [newComment, ...state.post.comments]
        }
      };
    });
  }

  componentDidMount() {
    this.updateComments();
  }

  render() {
    if (!this.state.post) {
      return <div></div>;
    }
    const post = this.state.post;
    let [header, postText] = getHeader(post);

    return (
      <div>
        <Link to={`/r/${post.subreddit}/`}>/r/{post.subreddit}</Link>
        {header}
        {postText}
        <p>{post.score} point{post.score === 1 ? '' : 's'}</p>
        <p>Submitted at {post.created} by {post.author}</p>
        <p>{post.numComments} comment{post.numComments === 1 ? '' : 's'}</p>
        <hr />
        <CommentForm
          postId={this.state.post.id}
          updatePost={this.updatePost}
          updateParent={this.addNewComment}
          topComment={true}
          show={true}
        />
        {post.comments.map((comment) => {
          return (
            <Comment
              key={comment.id}
              comment={comment}
              post={this.state.post}
              updatePost={this.updatePost}
            />
          );
        })}
      </div>
    );
  }
}

class Subreddit extends Component {
  constructor(props) {
    super(props);
    this.state = {posts: [], error: false};
  }

  componentDidMount() {
    fetch(`/r/${this.props.match.params.name}/`)
      .then(response => {
        if (response.status !== 200) {
          return this.setState({error: true});
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }

  render() {
    let posts;
    if (this.state.error) {
      posts = <p>There was an error rendering posts</p>;
    } else if (this.state.posts.length === 0) {
      posts = <p>No posts to show</p>;
    } else {
      posts = this.state.posts.map((post, idx) => {
        return (
          <Post
            post={post}
            key={idx}
          />
        );
      });
    }
    let createPosts = '';
    const { name } = this.props.match.params;
    if (authenticated()) {
      createPosts = (
        <div>
          <Link to={`/r/${name}/create-link-post`}>Create Link Post</Link>
          <br />
          <Link to={`/r/${name}/create-text-post`}>Create Text Post</Link>
        </div>
      );
    }

    return (
      <div>
        <h1>/r/{name}</h1>
        {createPosts}
        <h2>Posts:</h2>
        <div>
          {posts}
        </div>
      </div>
    );
  }
}

class Post extends Component {
  render() {
    const post = this.props.post;
    let [header, _] = getHeader(post);
    return (
      <div>
        {header}
        <p><Link to={`/r/${post.subreddit}`}>/r/{post.subreddit}</Link></p>
        <p>
          <Link to={`/r/${post.subreddit}/${post.id}/${post.slug}/comments`}>
            {post.numComments} Comment{post.numComments === 1 ? '' : 's'}
          </Link>
        </p>
        <p>{post.score} point{post.score === 1 ? '' : 's'}</p>
      </div>
    );
  }
}

class RegistrationLoginForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      email: '',
      password: '',
      errors: []
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleInputChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  handleSubmit(event) {
    const endpoint = this.props.registration ? 'users/' : 'users/login/';
    fetch(`/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: {
          username: this.state.username,
          email: this.state.email,
          password: this.state.password
        }
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.errors) {
          let formattedErrors = [];
          for (let [errorKey, [errorMessage, ..._]] of Object.entries(data.errors)) {
            formattedErrors.push({
              key: errorKey,
              message: errorMessage
            });
          }
          this.setState({errors: formattedErrors});
        } else {
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('jwtToken', data.user.token);
          this.props.login(data.user);
          window.location.reload();
        }
      });
    event.preventDefault();
  }

  render() {
    let error = '';
    if (this.state.errors.length > 0) {
      error = this.state.errors.map(e => {
        return (
          <Alert variant="danger">
            {e.key}: {e.message}
          </Alert>
        );
      });
    }
    return (
      <div>
        <p><strong>{this.props.registration ? 'Or register' : 'Login'}</strong></p>
        {error}
        <Form onSubmit={this.handleSubmit}>
          <Col xs={2}>
            <Form.Control
              name="username"
              placeholder="username"
              size="sm"
              onChange={this.handleInputChange}
            />
          </Col>
          {this.props.registration ?
           (<Col xs={2}>
              <Form.Control
                name="email"
                type="email"
                placeholder="email (optional)"
                size="sm"
                onChange={this.handleInputChange}
              />
            </Col>) : ''}
          <Col xs={2}>
            <Form.Control
              name="password"
              type="password"
              placeholder="password"
              size="sm"
              onChange={this.handleInputChange}
            />
          </Col>
          <Col>
            <Button type="submit" size="sm">Submit</Button>
          </Col>
        </Form>
      </div>
    );
  }
}

function authenticated() {
  return localStorage.getItem('username') && localStorage.getItem('jwtToken');
}

class CreateNewSubredditForm extends Component {
  constructor(props) {
    super(props);
    this.state = {
      redirect: false,
      name: ''
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handleSubmit(event) {
    fetch('/subreddit/create/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({
        subreddit: {
          name: this.state.name
        }
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.errors) {

        } else {
          this.setState({
            redirect: true
          });
        }
      });
    event.preventDefault();
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  renderRedirect() {
    if (this.state.redirect) {
      return <Redirect to={`/r/${this.state.name}`} />;
    }
    return '';
  }

  render() {
    return (
      <div>
        {this.renderRedirect()}
        <Form inline onSubmit={this.handleSubmit}>
          <InputGroup>
            <InputGroup.Prepend>
              <InputGroup.Text id="inputGroupPrepend">/r/</InputGroup.Text>
            </InputGroup.Prepend>
            <Form.Control
              placeholder="Subreddit Name"
              name="name"
              onChange={this.handleChange}
            />
          </InputGroup>
          <Button type="submit">Create New Subreddit</Button>
        </Form>
      </div>
    );
  }
}

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: [],
    };
  }

  componentDidMount() {
    fetch('/posts/')
      .then(response => {
        if (response.status !== 200) {
          return console.warn('Uh oh');
        }
        return response.json();
      })
      .then(data => this.setState({posts: data.posts}));
  }

  render() {
    let createSubreddit = '';
    if (authenticated()) {
      createSubreddit = <CreateNewSubredditForm />;
    }
    return (
      <div>
        {createSubreddit}
        {this.state.posts.map((post, idx) => {
          return (
            <Post
              post={post}
              key={idx}
            />
          );
        })}
      </div>
    );
  }
}

class CreatePost extends Component {
  constructor(props) {
    super(props);
    this.state = {
      title: '',
      text: '',
      link:'',
      is_link: this.props.link
    };
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  handleSubmit(event) {
    fetch(`/r/${this.props.match.params.name}/create-post/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({
        post: {
          title: this.state.title,
          is_link: this.state.is_link,
          text: this.state.text,
          link: this.state.link
        }})
    })
      .then(response => response.json())
      .then(data => {
        this.setState({
          redirectTo: `/r/${data.subreddit}/${data.id}/${data.slug}/comments`
        });
      });
    event.preventDefault();
  }

  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    });
  }

  render() {
    let redirect = '';
    if (this.state.redirectTo) {
      redirect = <Redirect to={this.state.redirectTo} />;
    }
    let body;
    if (this.props.link) {
      body = (
        <Form.Group as={Col} md="6" controlId="link">
          <Form.Label>Link</Form.Label>
          <Form.Control
            onChange={this.handleChange}
            type="url"
            name="link"
            placeholder="http://example.com"
          />
        </Form.Group>
      );
    } else {
      body = (
        <Form.Group as={Col} md="6" controlId="text">
          <Form.Label>Text</Form.Label>
          <Form.Control
            onChange={this.handleChange}
            as="textarea"
            name="text"
            placeholder="Text (Optional)"
            rows="10"
          />
        </Form.Group>
      );
    }
    return (
      <div>
        {redirect}
        <h1>
          <Link to={`/r/${this.props.match.params.name}`}>
            /r/{this.props.match.params.name}
          </Link>
        </h1>
        <h2>Create new {this.props.link ? 'link' : 'text'} post:</h2>
        <Form onSubmit={this.handleSubmit}>
          <Form.Group as={Col} md="6" controlId="title">
            <Form.Label>Title</Form.Label>
            <Form.Control
              onChange={this.handleChange}
              placeholder="Title"
              name="title"
            />
          </Form.Group>
          {body}
          <Col>
            <Button type="submit">Submit</Button>
          </Col>
        </Form>
      </div>
    );
  }
}

class SubredditList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      subredditList: []
    };
  }

  componentDidMount() {
    fetch('/subreddits/')
      .then(response => response.json())
      .then(data => {
        this.setState({
          subredditList: data
        });
      });
  }

  render() {
    let createSubreddit = '';
    if (authenticated()) {
      createSubreddit = <CreateNewSubredditForm />;
    }
    return (
      <div>
        {createSubreddit}
        <h1>Subreddits:</h1>
        <ul>
          {this.state.subredditList.map((s, idx) => (
            <li key={idx}>
              <Link to={`/r/${s.name}`}>/r/{s.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loggedIn: false
    };
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }

  login(user) {
    this.setState({
      loggedIn: true,
      user: user
    });
  }

  logout() {
    localStorage.clear();
    window.location.reload();
  }

  componentDidMount() {
    if (authenticated()) {
      this.setState({
        loggedIn: true,
        user: {
          username: localStorage.getItem('username')
        }
      });
    }
  }

  render() {
    let userInfo;
    let logoutLink = '';
    if (this.state.loggedIn) {
      userInfo = <p>Welcome {this.state.user.username}</p>;
      logoutLink = <Nav.Link href="#" onClick={this.logout}>Logout</Nav.Link>;
    } else {
      userInfo = (
        <div>
          <RegistrationLoginForm login={this.login} registration={false} />
          <RegistrationLoginForm login={this.login} registration={true} />
        </div>
      );
    }
    return (
      <Router>
        <Navbar bg="dark" variant="dark">
          <Navbar.Brand href="/">Reddit Clone</Navbar.Brand>
          <Nav className="mr-auto">
            <Nav.Link href="/subreddits/">Subreddits</Nav.Link>
          </Nav>
          <Nav>
            {logoutLink}
          </Nav>
        </Navbar>
        {userInfo}
        <Route exact path="/" component={Home} />
        <Route path="/subreddits/" component={SubredditList} />
        <Switch>
          <Route path="/r/:name/:id/:slug/comments" component={CommentsPage}/>
          <Route
            path="/r/:name/create-text-post"
            render={(props) => <CreatePost {...props} link={false} />}
          />
          <Route
            path="/r/:name/create-link-post"
            render={(props) => <CreatePost {...props} link={true} />}
          />
          <Route path="/r/:name" component={Subreddit} />
        </Switch>
      </Router>
    );
  }
}

export default App;
